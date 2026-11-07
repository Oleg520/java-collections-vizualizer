#!/usr/bin/python3
"""Root-owned, narrowly scoped deployment entry point. No configurable CLI paths."""
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import pwd
import signal
import stat
import subprocess
import sys
import tempfile
import time
import urllib.request
from dataclasses import dataclass

SERVICE = 'java-collections-visualizer.service'
LOCAL_HEALTH = 'http://127.0.0.1:18082/api/v1/health'
PUBLIC_HEALTH = 'https://jcv-api.135-106-208-51.sslip.io/api/v1/health'
MAX_JAR_BYTES = 96 * 1024 * 1024


class DeployError(Exception):
    pass


@dataclass(frozen=True)
class Paths:
    app: Path = Path('/opt/java-collections-visualizer')
    incoming: Path = Path('/var/lib/jcv-deploy/incoming')
    lock: Path = Path('/run/lock/java-collections-visualizer-deploy.lock')
    upload_uid: int | None = None


def secure_directory(path):
    mode = path.lstat()
    if not stat.S_ISDIR(mode.st_mode) or mode.st_uid != os.geteuid() or mode.st_mode & 0o022:
        raise DeployError('Deployment directories must be owned by root and not writable by other users')


def digest_file(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def previous_release(paths):
    current = paths.app / 'current.jar'
    if not current.is_symlink():
        raise DeployError('current.jar must point to an existing release; bootstrap is an owner action')
    target = current.resolve(strict=True)
    info = target.lstat()
    if target.parent != paths.app / 'releases' or not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o022:
        raise DeployError('Previous release must be a trusted regular JAR in releases')
    return os.readlink(current)


def stage_jar(paths, sha, expected):
    source = paths.incoming / (sha + '.jar')
    upload_uid = paths.upload_uid if paths.upload_uid is not None else pwd.getpwnam('jcv-deploy').pw_uid
    directory = os.open(paths.incoming, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        if os.fstat(directory).st_uid != upload_uid:
            raise DeployError('Upload directory has an unexpected owner')
        fd = os.open(source.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
    finally:
        os.close(directory)
    staging = None
    try:
        with os.fdopen(fd, 'rb') as incoming:
            info = os.fstat(incoming.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_uid != upload_uid or info.st_nlink != 1 or not 0 < info.st_size <= MAX_JAR_BYTES:
                raise DeployError('Upload must be a single regular file within the JAR size limit')
            with tempfile.NamedTemporaryFile(dir=paths.app / 'releases', prefix='.staging-', delete=False) as target:
                staging = Path(target.name)
                digest = hashlib.sha256()
                total = 0
                while chunk := incoming.read(1024 * 1024):
                    total += len(chunk)
                    if total > MAX_JAR_BYTES:
                        raise DeployError('Upload exceeds the JAR size limit')
                    target.write(chunk)
                    digest.update(chunk)
                target.flush()
                os.fsync(target.fileno())
            if digest.hexdigest() != expected:
                raise DeployError('Copied artifact SHA-256 does not match; current release is unchanged')
            release = paths.app / 'releases' / (sha + '.jar')
            if release.exists() or release.is_symlink():
                info = release.lstat()
                if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o022 or digest_file(release) != expected:
                    raise DeployError('Immutable release already exists with different content or unsafe permissions')
            else:
                # Runtime group may read only after the copied artifact has been verified.
                os.chown(staging, -1, (paths.app / 'releases').stat().st_gid)
                staging.chmod(0o640)
                os.rename(staging, release)
            return release
    finally:
        if staging is not None:
            staging.unlink(missing_ok=True)


def switch(paths, target):
    temp = paths.app / '.current-next'
    temp.unlink(missing_ok=True)
    temp.symlink_to(target)
    os.replace(temp, paths.app / 'current.jar')


def restart(reset_failed=False):
    if reset_failed:
        subprocess.run(['/usr/bin/systemctl', 'reset-failed', SERVICE], check=True, timeout=10,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(['/usr/bin/systemctl', 'restart', SERVICE], check=True, timeout=45,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def wait_for_health(url):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for attempt in range(20):
        try:
            with opener.open(url, timeout=5) as response:
                result = json.loads(response.read(4096))
                if response.status == 200 and isinstance(result, dict) and result.get('status') == 'UP' and result.get('java') == '21':
                    return
        except (OSError, ValueError):
            pass
        if attempt < 19:
            time.sleep(2)
    raise DeployError('Health check failed: ' + ('localhost' if url == LOCAL_HEALTH else 'public HTTPS'))


@contextlib.contextmanager
def rollback_signals():
    # Once recovery starts, a second catchable cancellation must not interrupt it.
    previous = {sig: signal.signal(sig, signal.SIG_IGN)
                for sig in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT)}
    try:
        yield
    finally:
        for sig, handler in previous.items():
            signal.signal(sig, handler)


def diagnostics():
    try:
        result = subprocess.run(['/usr/bin/systemctl', 'show', SERVICE, '--no-pager',
                                 '--property=ActiveState,SubState,MainPID,Result'],
                                text=True, capture_output=True, timeout=10)
        print(result.stdout.strip(), file=sys.stderr)
    except (OSError, subprocess.SubprocessError):
        print('Service status unavailable', file=sys.stderr)


def deploy(sha, expected, paths=Paths()):
    if not re.fullmatch(r'[0-9a-f]{40}', sha) or not re.fullmatch(r'[0-9a-f]{64}', expected):
        raise DeployError('Expected a full commit SHA and a SHA-256 digest')
    secure_directory(paths.app)
    secure_directory(paths.app / 'releases')
    secure_directory(paths.incoming.parent)
    if paths.incoming.is_symlink() or not paths.incoming.is_dir():
        raise DeployError('Invalid upload directory')
    lock_fd = os.open(paths.lock, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(lock_fd, 'a') as lock:
        info = os.fstat(lock.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_nlink != 1:
            raise DeployError('Unsafe deployment lock')
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise DeployError('Another backend deployment is running') from error
        previous = previous_release(paths)
        release = stage_jar(paths, sha, expected)
        switched = False
        try:
            switched = True
            switch(paths, 'releases/' + release.name)
            restart()
            wait_for_health(LOCAL_HEALTH)
            wait_for_health(PUBLIC_HEALTH)
        except BaseException as original:
            diagnostics()
            if switched:
                try:
                    with rollback_signals():
                        switch(paths, previous)
                        restart(reset_failed=True)
                        wait_for_health(LOCAL_HEALTH)
                        wait_for_health(PUBLIC_HEALTH)
                    print('Rollback restored the previous release and both health checks passed', file=sys.stderr)
                except BaseException as rollback_error:
                    diagnostics()
                    raise DeployError('Deployment failed; rollback could not be verified. Owner intervention required') from rollback_error
            raise DeployError('Deployment failed; previous release restored') from original
        print('Deployed commit ' + sha + ' SHA-256 ' + expected)
        print('Local and public HTTPS health checks passed')


def interrupted(_signum, _frame):
    raise DeployError('Deployment interrupted')


def main():
    if os.geteuid() != 0 or len(sys.argv) != 3:
        print('Run as root: jcv-deploy COMMIT_SHA SHA256', file=sys.stderr)
        return 2
    for sig in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
        signal.signal(sig, interrupted)
    try:
        deploy(sys.argv[1], sys.argv[2])
        return 0
    except Exception as error:
        # Deliberately do not print untrusted arguments, environment, upload bytes or tracebacks.
        print(str(error) if isinstance(error, DeployError) else 'Deployment failed before activation', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())

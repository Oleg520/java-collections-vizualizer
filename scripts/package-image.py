#!/usr/bin/env python3
"""Package an already-tested JAR, never rebuild Maven or access production."""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = 'Oleg520/java-collections-vizualizer'
BASE = ('eclipse-temurin:21-jre-noble@sha256:'
        '42b0171b55ff43cbb258de3a1c4a81cb11a96c15b2d8d9a9284a252c1d038605')


def sha256(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def jar_identity(path, revision, manifest=None):
    if not re.fullmatch('[a-f0-9]{40}', revision):
        raise ValueError('Exact source SHA required')
    path = Path(path)
    if path.is_symlink() or not 0 < path.stat().st_size <= 96 * 1024**2:
        raise ValueError('Expected bounded regular JAR')
    with zipfile.ZipFile(path) as archive:
        info = archive.getinfo('META-INF/build-info.properties')
        if info.file_size > 16384:
            raise ValueError('Oversized build metadata')
        versions = [l.removeprefix('build.version=') for l in archive.read(info).decode().splitlines()
                    if l.startswith('build.version=')]
    if len(versions) != 1 or not re.fullmatch(
            r'(?:[0-9]+\.[0-9]+\.[0-9]+|0\.0\.0-[a-f0-9]{40}-SNAPSHOT)', versions[0]):
        raise ValueError('Invalid JAR version')
    version, digest = versions[0], sha256(path)
    if manifest is not None:
        if (manifest.get('schema') != 1 or manifest.get('repository') != REPOSITORY
                or manifest.get('sha') != revision or manifest.get('version') != version
                or manifest.get('files', {}).get('backend.jar') != {
                    'size': path.stat().st_size, 'sha256': digest}):
            raise ValueError('JAR/source differs from verified release manifest')
    elif version != '0.0.0-' + revision + '-SNAPSHOT':
        # Tagged/release images always require the original bundle binding.
        raise ValueError('Release manifest required for a non-snapshot JAR')
    return version, digest


def archive_identity(path):
    # docker save supports both classic and OCI-backed image stores. Config digest
    # is the cross-store identity; docker inspect .Id may instead be a manifest ID.
    with tarfile.open(path) as archive:
        manifests = archive.getmembers()
        named = [m for m in manifests if m.name == 'manifest.json']
        if len(named) != 1 or not named[0].isfile() or named[0].size > 65536:
            raise ValueError('Missing bounded Docker manifest')
        entries = json.load(archive.extractfile(named[0]))
        if len(entries) != 1:
            raise ValueError('Expected one image')
        name = entries[0]['Config']
        config = archive.getmember(name)
        if not config.isfile() or config.size > 1024**2:
            raise ValueError('Invalid image config')
        data = archive.extractfile(config).read()
        return 'sha256:' + hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jar', required=True, type=Path)
    parser.add_argument('--revision', required=True)
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'image-bundle')
    args = parser.parse_args()
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    if args.revision != head or os.environ.get('GITHUB_SHA', head) != head:
        parser.error('Source SHA must equal the selected checkout')
    manifest = json.loads(args.manifest.read_text()) if args.manifest else None
    version, digest = jar_identity(args.jar, head, manifest)
    if args.output.exists():
        parser.error('Output must not exist')
    image = 'jcv-backend:' + head
    with tempfile.TemporaryDirectory(prefix='jcv-image-context-') as directory:
        context = Path(directory)
        shutil.copyfile(args.jar, context / 'backend.jar')
        shutil.copyfile(ROOT / 'docker/Dockerfile', context / 'Dockerfile')
        subprocess.run(['docker', 'build', '--platform', 'linux/amd64', '--provenance=false',
                        '--build-arg', 'REVISION=' + head, '--build-arg', 'JAR_SHA256=' + digest,
                        '--build-arg', 'APP_VERSION=' + version, '-t', image, str(context)],
                       check=True, timeout=600)
        subprocess.run(['python3', str(ROOT / 'scripts/check-container.py'), '--image', image,
                        '--revision', head, '--version', version, '--jar-sha256', digest],
                       check=True, timeout=180)
        archive = context / 'image.tar'
        subprocess.run(['docker', 'image', 'save', '-o', str(archive), image], check=True, timeout=120)
        config_digest = archive_identity(archive)
        args.output.mkdir()
        target = args.output / 'image.tar.gz'
        with archive.open('rb') as source, target.open('wb') as sink:
            with gzip.GzipFile(fileobj=sink, mode='wb', mtime=0) as compressed:
                shutil.copyfileobj(source, compressed)
    image_id = subprocess.check_output(['docker', 'image', 'inspect', image, '--format', '{{.Id}}'],
                                       text=True).strip()
    metadata = {
        'schema': 1, 'repository': REPOSITORY, 'sha': head, 'version': version,
        'platform': 'linux/amd64', 'base_image': BASE, 'image_tag': image,
        'jar_sha256': digest, 'config_digest': config_digest, 'producer_image_id': image_id,
        'archive': {'sha256': sha256(target), 'size': target.stat().st_size},
        'bundle_manifest_sha256': sha256(args.manifest) if args.manifest else None,
        'build': {'run_id': os.environ.get('GITHUB_RUN_ID', 'local'),
                  'attempt': os.environ.get('GITHUB_RUN_ATTEMPT', '0'),
                  'event': os.environ.get('GITHUB_EVENT_NAME', 'local')},
    }
    (args.output / 'image.json').write_text(json.dumps(metadata, sort_keys=True, indent=2) + '\n')
    print(json.dumps(metadata, sort_keys=True))


if __name__ == '__main__':
    main()

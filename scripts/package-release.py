#!/usr/bin/env python3
"""Package verified application bytes; no delivery credentials or infrastructure."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
from urllib.parse import urlsplit
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def origin(value):
    url = urlsplit(value)
    if (url.scheme != 'https' or not url.hostname or url.username or url.password
            or url.path or url.query or url.fragment
            or any(c.isspace() or ord(c) < 32 for c in value)):
        raise ValueError('Expected an HTTPS API origin without trailing slash')
    return value


def build_manifest(sha, version, api_origin, files):
    if not re.fullmatch(r'[a-f0-9]{40}', sha) or not re.fullmatch(
            r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', version):
        raise ValueError('Expected exact release identity')
    return {'schema': 1, 'repository': 'Oleg520/java-collections-vizualizer',
            'sha': sha, 'version': version, 'api_origin': origin(api_origin),
            'files': {name: {'sha256': hashlib.sha256(data).hexdigest(), 'size': len(data)}
                      for name, data in files.items()}}


def main():
    api_origin = origin(os.environ['VITE_API_URL'])
    version = subprocess.check_output(['sh', 'scripts/require-frontend-release.sh'], cwd=ROOT, text=True).strip()
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    jar = ROOT / Path(subprocess.check_output(['sh', 'scripts/backend-jar.sh'], cwd=ROOT, text=True).strip())
    with zipfile.ZipFile(jar) as archive:
        info = archive.read('META-INF/build-info.properties').decode()
        if [line for line in info.splitlines() if line.startswith('build.version=')] != ['build.version=' + version]:
            raise ValueError('JAR build-info version differs from release')
    output = ROOT / 'release-bundle'
    output.mkdir(exist_ok=False)
    shutil.copyfile(jar, output / 'backend.jar')
    dist = ROOT / 'frontend/dist'
    if ((dist / '_headers').read_bytes() != (ROOT / 'frontend/public/_headers').read_bytes()
            or not (dist / 'index.html').is_file()
            or any((dist / name).exists() for name in ('404.html', '_redirects', '_worker.js', 'functions'))):
        raise ValueError('Unexpected static SPA output')
    (dist / 'release.json').write_text(json.dumps({'sha': sha, 'version': version}) + '\n')
    with tarfile.open(output / 'frontend.tar', 'w') as archive:
        for path in sorted(dist.rglob('*')):
            if path.is_symlink() or not (path.is_file() or path.is_dir()):
                raise ValueError('Unexpected frontend output type')
            if path.is_file():
                entry = archive.gettarinfo(str(path), str(path.relative_to(dist)))
                entry.uid = entry.gid = entry.mtime = 0
                entry.uname = entry.gname = ''
                entry.mode = 0o644
                with path.open('rb') as stream:
                    archive.addfile(entry, stream)
    files = {name: (output / name).read_bytes() for name in ('backend.jar', 'frontend.tar')}
    manifest = build_manifest(sha, version, api_origin, files)
    (output / 'release.json').write_text(json.dumps(manifest, sort_keys=True, indent=2) + '\n')


if __name__ == '__main__':
    main()

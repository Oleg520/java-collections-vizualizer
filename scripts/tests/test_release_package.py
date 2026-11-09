import importlib.util
import json
import os
import tarfile
import tempfile
from unittest.mock import patch
import zipfile
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location('package', Path(__file__).parents[1] / 'package-release.py')
package = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(package)


class ReleasePackageTests(unittest.TestCase):
    def test_identity_and_digests(self):
        manifest = package.build_manifest('a' * 40, '1.2.3', 'https://api.example.com', {'backend.jar': b'fixture'})
        self.assertEqual(7, manifest['files']['backend.jar']['size'])
        self.assertEqual(64, len(manifest['files']['backend.jar']['sha256']))

    def test_packages_from_other_working_directory_and_embeds_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'scripts').mkdir()
            (root / 'backend/target').mkdir(parents=True)
            jar = root / 'backend/target/backend-1.2.3.jar'
            with zipfile.ZipFile(jar, 'w') as archive:
                archive.writestr('META-INF/build-info.properties', 'build.version=1.2.3\n')
            dist = root / 'frontend/dist'
            public = root / 'frontend/public'
            dist.mkdir(parents=True)
            public.mkdir()
            (public / '_headers').write_bytes(b'inert headers')
            (dist / '_headers').write_bytes(b'inert headers')
            (dist / 'index.html').write_bytes(b'inert html')
            with patch.object(package, 'ROOT', root), patch.dict(os.environ, VITE_API_URL='https://api.example.com'), \
                    patch.object(package.subprocess, 'check_output', side_effect=[
                        '1.2.3\n', 'a' * 40 + '\n', 'scripts/../backend/target/backend-1.2.3.jar\n']):
                package.main()
            manifest = json.loads((root / 'release-bundle/release.json').read_text())
            self.assertEqual('1.2.3', manifest['version'])
            with tarfile.open(root / 'release-bundle/frontend.tar') as archive:
                self.assertEqual({'sha': 'a' * 40, 'version': '1.2.3'},
                                 json.load(archive.extractfile('release.json')))
                self.assertTrue(all(e.mtime == 0 and e.uid == e.gid == 0 for e in archive))

    def test_rejects_nonrelease_and_invalid_origins(self):
        for version in ['dev', 'v1.2.3', '01.2.3', '1.2.3\n']:
            with self.assertRaises(ValueError):
                package.build_manifest('a' * 40, version, 'https://api.example.com', {})
        for value in ['http://api.example.com', 'https://user:pass@api.example.com',
                      'https://api.example.com/', 'https://api.example.com\n']:
            with self.assertRaises(ValueError):
                package.origin(value)

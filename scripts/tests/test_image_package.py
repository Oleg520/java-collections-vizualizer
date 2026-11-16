import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
import zipfile

SPEC = importlib.util.spec_from_file_location('image_package', Path(__file__).parents[1] / 'package-image.py')
package = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(package)
SHA = 'a' * 40


class ImagePackageTests(unittest.TestCase):
    def jar(self, root, version='1.2.3'):
        path = root / 'backend.jar'
        with zipfile.ZipFile(path, 'w') as archive:
            archive.writestr('META-INF/build-info.properties', 'build.version=' + version + '\n')
        return path

    def test_original_release_manifest_binds_exact_jar_source_and_version(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.jar(Path(directory))
            digest = package.sha256(path)
            manifest = {'schema': 1, 'repository': package.REPOSITORY, 'sha': SHA,
                        'version': '1.2.3', 'files': {'backend.jar': {
                            'sha256': digest, 'size': path.stat().st_size}}}
            self.assertEqual(('1.2.3', digest), package.jar_identity(path, SHA, manifest))
            for change in [{'sha': 'b' * 40}, {'version': '1.2.4'}, {'schema': 2},
                           {'repository': 'fork/other'}, {'files': {}}]:
                with self.subTest(change=change), self.assertRaises(ValueError):
                    package.jar_identity(path, SHA, {**manifest, **change})
            with self.assertRaises(ValueError):
                package.jar_identity(path, SHA)
            link = path.with_name('link.jar')
            link.symlink_to(path)
            with self.assertRaises(ValueError):
                package.jar_identity(link, SHA, manifest)

    def test_pr_snapshot_is_bound_to_checkout_sha(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.jar(Path(directory), '0.0.0-' + SHA + '-SNAPSHOT')
            package.jar_identity(path, SHA)
            with self.assertRaises(ValueError):
                package.jar_identity(path, 'b' * 40)

    def test_config_identity_comes_from_saved_bytes_not_store_specific_image_id(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'image.tar'
            config = b'{"architecture":"amd64"}'
            digest = hashlib.sha256(config).hexdigest()
            for filename in ['blobs/sha256/' + digest, digest + '.json']:
                with tarfile.open(path, 'w') as archive:
                    for name, content in [('manifest.json', json.dumps([{'Config': filename}]).encode()),
                                          (filename, config)]:
                        item = tarfile.TarInfo(name)
                        item.size = len(content)
                        archive.addfile(item, io.BytesIO(content))
                self.assertEqual('sha256:' + digest, package.archive_identity(path))

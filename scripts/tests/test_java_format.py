"""Formatter infrastructure checks use temporary sources and fake installations."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('java_format', ROOT / 'scripts/java-format.py')
formatter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(formatter)


class JavaFormatTest(unittest.TestCase):
    def setUp(self):
        self.temp = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.enterContext(patch.object(formatter, 'ROOT', self.temp))
        self.enterContext(patch.dict(os.environ, {'XDG_CACHE_HOME': str(self.temp / 'cache')}))
        os.environ.pop('JAVA_FORMATTER_HOME', None)

    def fake_installation(self, home):
        (home / 'bin').mkdir(parents=True)
        (home / 'bin/idea.sh').write_text('#!/bin/sh\nexit 0\n')
        (home / 'product-info.json').write_text(json.dumps({
            'version': formatter.VERSION, 'buildNumber': formatter.BUILD,
        }))
        return home

    def test_scope_includes_both_modules_sources_and_tests_only(self):
        expected = []
        for module in ('core', 'backend'):
            for source in ('main', 'test'):
                path = self.temp / module / 'src' / source / 'java/example/A.java'
                path.parent.mkdir(parents=True)
                path.write_text('class A {}\n')
                expected.append(path)
        for relative in ('core/target/generated/A.java', 'frontend/src/A.java',
                         'backend/src/test/resources/A.java'):
            path = self.temp / relative
            path.parent.mkdir(parents=True)
            path.write_text('must remain untouched')
        self.assertEqual(sorted(expected), formatter.java_sources())

    def test_wrong_build_fails_before_any_formatter_launch(self):
        home = self.fake_installation(self.temp / 'idea')
        (home / 'product-info.json').write_text('{"version":"2026.3","buildNumber":"other"}')
        with patch.dict(os.environ, JAVA_FORMATTER_HOME=str(home)):
            with self.assertRaisesRegex(ValueError, 'requires IntelliJ IDEA'):
                formatter.installation()

    def test_check_is_one_batch_dry_run_and_propagates_rejection(self):
        files = [self.temp / 'core/A.java', self.temp / 'backend/B.java']
        home = self.fake_installation(self.temp / 'idea')
        with patch.object(formatter, 'java_sources', return_value=files), \
             patch.object(formatter, 'installation', return_value=home), \
             patch('sys.argv', ['java-format.py', 'check']), \
             patch.object(formatter.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1)) as run:
            self.assertEqual(1, formatter.main())
        run.assert_called_once()
        command = run.call_args.args[0]
        self.assertIn('-dry', command)
        self.assertEqual([str(path) for path in files], command[-2:])
        env = run.call_args.kwargs['env']
        self.assertEqual(str(home / 'jbr'), env['IDEA_JDK'])
        self.assertNotEqual(os.environ.get('IDEA_PROPERTIES'), env['IDEA_PROPERTIES'])

    def test_empty_scope_fails_instead_of_silently_passing(self):
        with patch('sys.argv', ['java-format.py', 'check']):
            with self.assertRaisesRegex(ValueError, 'No core/backend Java sources'):
                formatter.main()

    def test_verified_download_is_installed_and_reused_offline(self):
        home = self.fake_installation(self.temp / 'download/idea')
        archive = io.BytesIO()
        with tarfile.open(fileobj=archive, mode='w:gz') as bundle:
            bundle.add(home, arcname='idea-build')
        data = archive.getvalue()
        archive_spec = {'x86_64': ('fixture.tar.gz', hashlib.sha256(data).hexdigest())}
        with patch.object(formatter.platform, 'system', return_value='Linux'), \
             patch.object(formatter.platform, 'machine', return_value='x86_64'), \
             patch.object(formatter, 'ARCHIVES', archive_spec), \
             patch.object(formatter, 'urlopen', return_value=io.BytesIO(data)) as download:
            installed = formatter.installation()
            self.assertEqual(installed, formatter.installation())
            download.assert_called_once()
            self.assertTrue((installed / 'bin/idea.sh').is_file())

    def test_bad_download_checksum_never_installs_or_extracts(self):
        with patch.object(formatter.platform, 'system', return_value='Linux'), \
             patch.object(formatter.platform, 'machine', return_value='x86_64'), \
             patch.object(formatter, 'urlopen', return_value=io.BytesIO(b'corrupted')), \
             patch.object(formatter.tarfile, 'open') as extract:
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                formatter.installation()
            extract.assert_not_called()
        self.assertEqual(['.install.lock'], sorted(p.name for p in (self.temp / 'cache/jcv-java-formatter').iterdir()))


if __name__ == '__main__':
    unittest.main()

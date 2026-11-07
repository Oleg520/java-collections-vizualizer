import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).parents[1] / 'upload_backend.sh'
SHA = 'b' * 40


class UploadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        binary = self.root / 'bin'
        binary.mkdir()
        for name in ('ssh-keygen', 'ssh', 'scp'):
            script = binary / name
            script.write_text('#!/bin/bash\nprintf "%s\\n" "$0 $*" >> "$CALL_LOG"\nexit "${FAKE_' + name.replace('-', '_').upper() + '_EXIT:-0}"\n')
            script.chmod(0o755)
        self.jar = self.root / 'artifact.jar'
        self.jar.write_bytes(b'tested artifact')
        self.hash = hashlib.sha256(self.jar.read_bytes()).hexdigest()
        self.env = dict(os.environ, PATH=str(binary) + os.pathsep + os.environ['PATH'],
                        RUNNER_TEMP=str(self.root), JCV_DEPLOY_SSH_KEY='inert test credential',
                        JCV_DEPLOY_KNOWN_HOSTS='inert test host record', CALL_LOG=str(self.root / 'calls'))

    def run_upload(self, digest=None):
        return subprocess.run(['bash', str(SCRIPT), SHA, digest or self.hash, str(self.jar)],
                              env=self.env, text=True, capture_output=True, timeout=10)

    def test_only_expected_host_and_helper_with_pinned_identity_and_no_secret_output(self):
        result = self.run_upload()
        self.assertEqual(0, result.returncode, result.stderr)
        calls = (self.root / 'calls').read_text()
        self.assertIn('StrictHostKeyChecking=yes', calls)
        self.assertIn('GlobalKnownHostsFile=/dev/null', calls)
        self.assertIn('jcv-deploy@135.106.208.51', calls)
        self.assertIn('sudo -n /usr/local/sbin/jcv-deploy ' + SHA + ' ' + self.hash, calls)
        self.assertNotIn('inert test credential', result.stdout + result.stderr)
        self.assertFalse(list(self.root.glob('jcv-ssh.*')))

    def test_bad_hash_prevents_any_ssh(self):
        result = self.run_upload('c' * 64)
        self.assertNotEqual(0, result.returncode)
        self.assertFalse((self.root / 'calls').exists())

    def test_transfer_failure_does_not_activate_and_cleans_key_files(self):
        self.env['FAKE_SCP_EXIT'] = '1'
        result = self.run_upload()
        self.assertNotEqual(0, result.returncode)
        self.assertNotIn('sudo -n', (self.root / 'calls').read_text())
        self.assertFalse(list(self.root.glob('jcv-ssh.*')))

    def test_missing_pinned_host_prevents_transfer(self):
        self.env['FAKE_SSH_KEYGEN_EXIT'] = '1'
        result = self.run_upload()
        self.assertNotEqual(0, result.returncode)
        self.assertNotIn('scp ', (self.root / 'calls').read_text())
        self.assertFalse(list(self.root.glob('jcv-ssh.*')))

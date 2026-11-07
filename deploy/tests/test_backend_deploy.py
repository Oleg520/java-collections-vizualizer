import fcntl
import hashlib
import importlib.util
import os
from pathlib import Path
import signal
import sys
import tempfile
import unittest
from unittest.mock import call, patch

spec = importlib.util.spec_from_file_location('backend_deploy', Path(__file__).parents[1] / 'backend_deploy.py')
deploy = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = deploy
spec.loader.exec_module(deploy)
SHA = 'a' * 40
NEW = b'new tested artifact'
DIGEST = hashlib.sha256(NEW).hexdigest()


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        app = root / 'app'
        (app / 'releases').mkdir(parents=True)
        incoming = root / 'uploads' / 'incoming'
        incoming.mkdir(parents=True)
        self.paths = deploy.Paths(app, incoming, root / 'deployment.lock', os.geteuid())
        self.previous = 'releases/830b799.jar'
        (app / self.previous).write_bytes(b'previous healthy artifact')
        (app / 'current.jar').symlink_to(self.previous)
        self.upload = incoming / (SHA + '.jar')
        self.upload.write_bytes(NEW)
        self.restart = self.enterContext(patch.object(deploy, 'restart'))
        self.health_impl = deploy.wait_for_health
        self.health = self.enterContext(patch.object(deploy, 'wait_for_health'))
        self.enterContext(patch.object(deploy, 'diagnostics'))

    def current(self):
        return os.readlink(self.paths.app / 'current.jar')

    def run_deploy(self, sha=SHA, digest=DIGEST):
        deploy.deploy(sha, digest, self.paths)

    def assert_unchanged(self):
        self.assertEqual(self.previous, self.current())
        self.restart.assert_not_called()
        self.assertFalse(list((self.paths.app / 'releases').glob('.staging-*')))

    def test_promotes_exact_artifact_and_checks_both_health_urls(self):
        self.run_deploy()
        target = self.paths.app / 'releases' / (SHA + '.jar')
        self.assertEqual(NEW, target.read_bytes())
        self.assertEqual(0o640, target.stat().st_mode & 0o777)
        self.assertEqual('releases/' + SHA + '.jar', self.current())
        self.restart.assert_called_once_with()
        self.assertEqual([call(deploy.LOCAL_HEALTH), call(deploy.PUBLIC_HEALTH)], self.health.call_args_list)
        self.assertEqual(b'previous healthy artifact', (self.paths.app / self.previous).read_bytes())

    def test_redeploying_identical_artifact_is_safe_but_never_overwrites_a_release(self):
        self.run_deploy()
        self.run_deploy()
        self.upload.write_bytes(b'different')
        before = self.current()
        with self.assertRaisesRegex(deploy.DeployError, 'Immutable release'):
            self.run_deploy(digest=hashlib.sha256(b'different').hexdigest())
        self.assertEqual(before, self.current())
        self.assertEqual(NEW, (self.paths.app / before).read_bytes())

    def test_hash_mismatch_and_path_arguments_never_activate(self):
        with self.assertRaises(deploy.DeployError):
            self.run_deploy(digest='b' * 64)
        for value in ('../../etc/passwd', 'a' * 40 + ';id', 'A' * 40, ''):
            with self.assertRaises(deploy.DeployError):
                self.run_deploy(sha=value)
        self.assert_unchanged()

    def test_symlink_hardlink_oversize_and_wrong_owner_uploads_are_rejected(self):
        self.upload.unlink()
        self.upload.symlink_to(self.paths.app / self.previous)
        with self.assertRaises(OSError):
            self.run_deploy()
        self.upload.unlink()
        os.link(self.paths.app / self.previous, self.upload)
        with self.assertRaises(deploy.DeployError):
            self.run_deploy()
        self.upload.unlink()
        self.upload.write_bytes(NEW)
        with patch.object(deploy, 'MAX_JAR_BYTES', 3), self.assertRaises(deploy.DeployError):
            self.run_deploy()
        wrong_owner = deploy.Paths(self.paths.app, self.paths.incoming, self.paths.lock, os.geteuid() + 1)
        with self.assertRaises(deploy.DeployError):
            deploy.deploy(SHA, DIGEST, wrong_owner)
        self.assert_unchanged()

    def test_no_bootstrap_and_no_unsafe_previous_target(self):
        current = self.paths.app / 'current.jar'
        current.unlink()
        with self.assertRaises(deploy.DeployError):
            self.run_deploy()
        current.symlink_to(self.upload)
        with self.assertRaises(deploy.DeployError):
            self.run_deploy()
        self.restart.assert_not_called()

    def test_concurrent_deployment_is_rejected_without_touching_current(self):
        with self.paths.lock.open('a') as held:
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with self.assertRaisesRegex(deploy.DeployError, 'Another backend deployment'):
                self.run_deploy()
        self.assert_unchanged()

    def test_restart_or_either_health_failure_rolls_back_and_clears_start_limit(self):
        for failure in ('restart', 'local', 'public'):
            with self.subTest(failure=failure):
                self.restart.reset_mock(side_effect=True)
                self.health.reset_mock(side_effect=True)
                if failure == 'restart':
                    self.restart.side_effect = [RuntimeError('restart failed'), None]
                elif failure == 'local':
                    self.health.side_effect = [deploy.DeployError('local'), None, None]
                else:
                    self.health.side_effect = [None, deploy.DeployError('public'), None, None]
                with self.assertRaisesRegex(deploy.DeployError, 'previous release restored'):
                    self.run_deploy()
                self.assertEqual(self.previous, self.current())
                self.assertEqual([call(), call(reset_failed=True)], self.restart.call_args_list)

    def test_interruption_immediately_after_switch_is_recovered(self):
        original = deploy.switch
        def interrupted(paths, target):
            original(paths, target)
            if target != self.previous:
                raise KeyboardInterrupt()
        with patch.object(deploy, 'switch', side_effect=interrupted):
            with self.assertRaisesRegex(deploy.DeployError, 'previous release restored'):
                self.run_deploy()
        self.assertEqual(self.previous, self.current())

    def test_rollback_failure_is_reported_distinctly(self):
        self.health.side_effect = deploy.DeployError('unhealthy')
        with self.assertRaisesRegex(deploy.DeployError, 'Owner intervention required'):
            self.run_deploy()
        self.assertEqual(self.previous, self.current())

    def test_recovery_ignores_repeated_cancellation_and_restores_handlers(self):
        before = signal.getsignal(signal.SIGTERM)
        with deploy.rollback_signals():
            self.assertEqual(signal.SIG_IGN, signal.getsignal(signal.SIGTERM))
        self.assertEqual(before, signal.getsignal(signal.SIGTERM))

    def test_health_requires_successful_json_with_status_up_and_java21(self):
        response = unittest.mock.MagicMock()
        response.__enter__.return_value = response
        response.status = 200
        opener = unittest.mock.Mock()
        opener.open.return_value = response
        with patch.object(deploy.urllib.request, 'build_opener', return_value=opener), patch.object(deploy.time, 'sleep'):
            response.read.return_value = b'{"status":"UP","java":"21"}'
            self.health_impl(deploy.LOCAL_HEALTH)
            for body in (b'{"status":"DOWN","java":"21"}', b'{"status":"UP","java":"17"}', b'not JSON', b'[]', b'null'):
                response.read.return_value = body
                with self.assertRaises(deploy.DeployError):
                    self.health_impl(deploy.PUBLIC_HEALTH)


if __name__ == '__main__':
    unittest.main()

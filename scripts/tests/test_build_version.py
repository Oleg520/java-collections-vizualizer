"""Version fixtures use disposable Git repositories, never the real release refs."""
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]


class BuildVersionTest(unittest.TestCase):
    def setUp(self):
        self.temp = self.enterContext(tempfile.TemporaryDirectory())
        self.repo = Path(self.temp) / 'repo'
        self.repo.mkdir()
        shutil.copytree(ROOT / 'scripts', self.repo / 'scripts', ignore=shutil.ignore_patterns('__pycache__'))
        self.env = {k: v for k, v in os.environ.items()
                    if not k.startswith(('GITHUB_', 'VERSIONING_', 'GIT_')) and k != 'COMMIT_REF'}
        self.env.update(GIT_AUTHOR_NAME='Version Test', GIT_COMMITTER_NAME='Version Test',
                        GIT_AUTHOR_EMAIL='test@example.invalid', GIT_COMMITTER_EMAIL='test@example.invalid')
        self.git('init', '-b', 'main')
        self.git('add', '.')
        self.git('commit', '-m', 'Fixture')
        self.sha = self.git('rev-parse', 'HEAD').stdout.strip()

    def git(self, *args):
        return subprocess.run(['git', *args], cwd=self.repo, env=self.env,
                              check=True, capture_output=True, text=True)

    def script(self, name='git-version.sh', *args, **env):
        return subprocess.run(['sh', str(self.repo / 'scripts' / name), *args],
                              cwd=self.repo, env=self.env | env, capture_output=True, text=True)

    def version(self, expected):
        result = self.script()
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual(expected, result.stdout.strip())

    def test_untagged_and_previous_release_are_dev(self):
        self.version('dev')
        self.git('tag', '0.2.0')
        self.git('commit', '--allow-empty', '-m', 'After release')
        self.version('dev')

    def test_plain_and_annotated_tags_on_branch_and_detached_head(self):
        for tag in ['0.2.0', '1.0.0']:
            with self.subTest(tag=tag):
                self.git('tag', '-a', tag, '-m', 'Fixture release')
                self.version(tag)
                self.git('checkout', '--detach')
                self.version(tag)
                self.assertEqual(0, self.script('git-version.sh', '--check-maven', tag).returncode)
                self.git('switch', 'main')
                self.git('tag', '-d', tag)

    def test_nonrelease_tags_are_ignored_and_cannot_be_requested_as_releases(self):
        for tag in ['v0.1.0', '01.2.3', '1.0', '1.0.0-rc.1']:
            self.git('tag', tag)
            self.version('dev')
            self.assertNotEqual(0, self.script(GITHUB_REF='refs/tags/' + tag).returncode)

    def test_multiple_release_tags_fail(self):
        self.git('tag', '0.2.0')
        self.git('tag', '1.0.0')
        result = self.script()
        self.assertNotEqual(0, result.returncode)
        self.assertIn('Multiple release tags', result.stderr)

    def test_ci_commit_and_maven_must_match_git(self):
        for var in ['COMMIT_REF', 'GITHUB_SHA']:
            self.assertNotEqual(0, self.script(**{var: 'a' * 40}).returncode)
        self.assertEqual(0, self.script('git-version.sh', '--check-maven',
                         '0.0.0-' + self.sha + '-SNAPSHOT').returncode)
        self.assertNotEqual(0, self.script('git-version.sh', '--check-maven', '0.2.0').returncode)
        self.assertNotEqual(0, self.script(GITHUB_REF='refs/tags/0.2.0').returncode)

    def test_netlify_fetches_tags_in_shallow_checkout_and_fails_on_fetch_error(self):
        remote = self.repo
        self.repo = Path(self.temp) / 'netlify'
        subprocess.run(['git', 'clone', '--depth=1', '--no-tags', remote.as_uri(), str(self.repo)],
                       env=self.env, check=True, capture_output=True)
        subprocess.run(['git', '-C', str(remote), 'tag', '-a', '0.2.0', '-m', 'Created after clone'],
                       env=self.env, check=True, capture_output=True)
        self.version('dev')
        result = self.script('fetch-version-tags.sh', NETLIFY='true', COMMIT_REF=self.sha)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual('0.2.0', result.stdout.strip())
        self.git('remote', 'set-url', 'origin', str(Path(self.temp) / 'missing'))
        self.assertNotEqual(0, self.script('fetch-version-tags.sh').returncode)

    def test_missing_git_metadata_fails(self):
        shutil.rmtree(self.repo / '.git')
        self.assertNotEqual(0, self.script().returncode)

    def test_jar_selection_rejects_missing_multiple_and_symlink(self):
        target = self.repo / 'backend' / 'target'
        target.mkdir(parents=True)
        self.assertNotEqual(0, self.script('backend-jar.sh').returncode)
        jar = target / 'backend-0.2.0.jar'
        jar.write_bytes(b'fixture')
        (target / 'backend-0.2.0.jar.original').write_bytes(b'not executable')
        result = self.script('backend-jar.sh')
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual(jar.resolve(), Path(result.stdout.strip()).resolve())
        stale = target / 'backend-0.1.0.jar'
        stale.write_bytes(b'stale')
        self.assertNotEqual(0, self.script('backend-jar.sh').returncode)
        stale.unlink()
        jar.unlink()
        jar.symlink_to(target / 'backend-0.2.0.jar.original')
        self.assertNotEqual(0, self.script('backend-jar.sh').returncode)

    def test_maven_and_shared_resolver_use_identical_tag_pattern(self):
        config = ET.parse(ROOT / '.mvn/maven-git-versioning-extension.xml')
        ns = {'v': 'https://github.com/qoomon/maven-git-versioning-extension'}
        refs = config.find('v:refs', ns)
        self.assertEqual('true', refs.attrib['considerTagsOnBranches'])
        pattern = refs.find('v:ref/v:pattern', ns).text
        shared = re.search(r"^pattern='([^']+)'$", (ROOT / 'scripts/git-version.sh').read_text(), re.M)[1]
        self.assertEqual(pattern, shared)


if __name__ == '__main__':
    unittest.main()

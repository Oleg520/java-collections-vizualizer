# Contributing

These conventions apply to all future contributions, including work by coding agents.

## Language and naming

- Use English for new branch names, commit subjects and bodies, PR titles and
  descriptions, and issue titles and descriptions.
- Russian documentation and the current Russian UI are allowed. Existing
  documentation does not need translation; UI localization is separate work.
- Use a clear branch prefix and a short English purpose, for example:
  `feat/add-tree-search`, `fix/limit-full-trace`, `docs/contributing-guidelines`,
  or `chore/update-build-tools`.
- Prefer Conventional Commits in English, such as
  `fix: reject full traces before executing commands` or
  `docs: add contribution guidelines`.

## One issue, one branch, one PR

1. Start from an up-to-date `main` and create one dedicated branch for the issue.
   Keep the change focused; unrelated issues belong in separate branches and PRs.
2. Commit and push to that branch. Do not push directly to `main` during normal
   development.
3. Open one PR targeting `main` and link the issue. Use `Closes #123` when the PR
   fully resolves it, or `Refs #123` for a related change that does not close it.
4. Explain the problem, resulting behavior, validation, and any material limitations
   in English. A title such as `Prevent oversized full trace responses` is preferred
   to a generic title such as `Fix bug`.
5. Obtain maintainer review and approval, and wait for successful CI before merge.
   Address review feedback and rerun affected checks after changes. Passing CI
   alone does not replace review. Coding agents must not merge without an explicit
   instruction from the maintainer.

Review and CI are team/process requirements; they do not require paid branch
protection features or changes to repository settings.

## Verification

Use the relevant build and test commands in the [README](README.md#проверка), and
record the results in the PR. For documentation-only changes, check Markdown,
local links, and `git diff --check`; new application tests are unnecessary.
The existing GitHub Actions checks must still pass before merge.

## Preserve existing history

Apply these conventions going forward. Do not rewrite existing Git history,
force-push rewritten published commits, or retroactively edit old PRs, issues,
or documentation merely to change their language or naming.

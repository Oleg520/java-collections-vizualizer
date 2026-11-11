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

## Java formatting (developers and coding agents)

Use JDK 21, Python 3.12+ and the Maven wrapper from the repository root on
Linux/WSL (x86_64 or aarch64):

```bash
./mvnw -Djava.format=apply validate  # apply the IntelliJ Java formatter
./mvnw -Djava.format=check validate  # read-only formatting and Git-version check
./mvnw clean verify                  # Java tests and backend JAR
```

The first formatting command downloads the official IntelliJ IDEA 2026.3 Linux
archive (~1.6 GB) and verifies its pinned SHA-256. It caches the installation under
`${XDG_CACHE_HOME:-~/.cache}/jcv-java-formatter`; subsequent runs work offline.
The formatter uses the bundled JetBrains Runtime; the application still uses
Java 21. To reuse an existing **Linux** installation, set `JAVA_FORMATTER_HOME`
to its root directory. The helper rejects versions other than build `263.7307.200`.
Windows developers can run the Maven commands in WSL. No paid license or external
formatter plugin is needed for Java formatting.

The source of truth is IntelliJ IDEA's own formatter, using its standard Java
style and the shared [code style scheme](config/java-formatter.xml). The scheme
sets a 120-column margin and **Wrap if long** for method/call parameters, call
chains, binary/ternary expressions and enum constants; other Java style settings
retain IDEA defaults. These syntax-specific options are stable after one pass,
unlike the generic **Wrap long lines** post-processing option in the tested
version. `.editorconfig`
sets matching Java editor basics: four spaces, eight-space continuations, LF, UTF-8
and a recommended
120-column margin. It does not change frontend settings. Long literals and
comments may exceed the margin; the formatter is not a hard line-length linter.

Before every Java PR, including agent-authored changes:

1. Run `./mvnw -Djava.format=apply validate`, then inspect the diff for unintended changes.
   Keep logic, API changes, magic-value cleanup and unrelated files outside
   formatting work. Do not run Optimize Imports, Rearrange Code or code cleanup
   as part of a formatting-only change.
2. Run `./mvnw -Djava.format=check validate`, the affected tests and `./mvnw clean verify`; record
   results in the PR. Do not bypass checks with exclusions or hand-adjust output.
3. Review formatter version, checksum and scheme upgrades together with their
   resulting Java diff. Do not enable a second Java formatter.

The `java.format` property activates a Maven profile that runs once for both
modules in `validate`. CI always runs `-Djava.format=check`; `-DskipTests` does not
skip this check. IDEA's native `-dry` mode never rewrites sources. Ordinary Maven
builds do not activate the tooling profile or download the IDE.
Run the formatting commands from the root, without `-pl` exclusions.

### IntelliJ IDEA

Use IntelliJ IDEA 2026.3 (build `263.7307.200`) and enable EditorConfig support.
In **Settings → Editor → Code Style → Scheme actions → Import Scheme → IntelliJ
IDEA code style XML**, import `config/java-formatter.xml` and select the imported
scheme for this project. Ordinary **Ctrl+Alt+L / Reformat Code** then uses the
same formatter and style as Maven/CI. Keep Optimize Imports, Rearrange Code and
code cleanup disabled for formatting-only changes. User-specific `.idea` files
remain untracked. Rerun the Maven formatting check before committing, especially
when using a different IDE version.

The CLI uses isolated temporary IDEA configuration/system/plugin directories,
so it can run while the developer's IDE is open and does not load personal plugins
or modify personal IDE settings. It starts IDEA once for all Java sources and
tests under `core/src/{main,test}/java` and `backend/src/{main,test}/java`.
Generated files, resources and frontend files are outside its scope.

Spotless was evaluated with Eclipse JDT and Palantir on representative controller,
session, DTO, engine, algorithm and test files. Their output differs from standard
IDEA formatting. Spotless's IDEA adapter also starts the IDE separately per file;
we use IDEA's official batch CLI through Maven's existing exec plugin instead.
This avoids recurring differences between Ctrl+Alt+L and CI. Formatting alone
does not simplify complex expressions; structural changes need a separate task.
See the [JetBrains CLI formatter documentation](https://www.jetbrains.com/help/idea/command-line-formatter.html)
and [Spotless IDEA adapter limitations](https://github.com/diffplug/spotless/tree/main/plugin-maven#intellij-idea).

Frontend retains its existing `npm --prefix frontend run format` command using
Prettier. It currently has no `format:check` script or CI formatting check; adding
one and reviewing its baseline belongs in a separate frontend formatting task.

## Preserve existing history

Apply these conventions going forward. Do not rewrite existing Git history,
force-push rewritten published commits, or retroactively edit old PRs, issues,
or documentation merely to change their language or naming.

## Java values and defaults

- Give shared rules an owner in the relevant model/component. Collection snapshot
  `SCHEMA_VERSION` values also govern their trace/session envelopes; error schema
  versions and compact wire encoding names have independent lifecycles. Avoid
  generic `Constants` classes and sharing values just because their numbers match.
- Keep request negotiation in `SnapshotProtocol`: `snapshotVersion=0` means
  unspecified, never HashMap V1 support. HashMap requires V2 before reads/writes;
  ArrayList retains its existing acceptance of 0/1/2. Missing/empty encoding selects
  `full`, subject to the full-trace policy; `compact` is a request selector, while
  `node-table-v2` and `array-frames-v1` identify response formats.
- Deployment defaults and environment overrides belong in `application.yml`;
  Java injects and validates them without repeating fallback defaults. Document
  sentinels next to their interpretation (for example, automatic per-client quota).
- Keep OpenJDK algorithm constants separate from collection teaching limits and
  deployment settings. Reuse an existing constant for the same rule, including
  reported bounds; leave routes, local JSON keys, ordinary arithmetic and concrete
  scenario data inline. Preserve independent literal expectations and fixed wire
  fixtures in contract tests so changing a constant cannot silently update the test.

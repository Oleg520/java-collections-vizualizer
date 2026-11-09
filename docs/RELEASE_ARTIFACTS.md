# Verified release artifacts

The public repository owns application source, local development, tests and
credential-free builds. Delivery, environment policy, credentials and recovery
belong to the operator. No private checkout or production access is needed to
develop, build or test this project.

## Build once

After review, successful PR CI and merge, publish one unique plain X.Y.Z tag on
the intended main SHA. Do not move tags or rebuild an existing deployed SHA
under another version. See [version rules](VERSIONING.md).

Run **Build release artifacts** manually on main. Supply the public HTTPS
API origin to compile into the static frontend; it is browser-visible build
configuration, never a credential. The tag must be on that exact dispatch SHA.
This workflow does not deploy, create a Release or use production secrets.

The same job runs version fixtures, Maven verification, TypeScript/Vite,
frontend unit tests and both Playwright suites against a local backend.
It then builds frontend assets for the supplied origin and packages:

| File | Contract |
| --- | --- |
| backend.jar | Exact verified executable JAR; build-info version equals the tag |
| frontend.tar | Static dist files; no symlinks/functions/workers or SPA-breaking 404 |
| release.json | Schema 1, repository, full SHA, version, API origin, file sizes and SHA-256 |

The bundle name is release-<full SHA>, retained for 90 days. Frontend includes a
small /release.json marker containing SHA/version for delivery verification.
The packager normalizes tar timestamps/ownership and the Maven workflow fixes
outputTimestamp to the source commit timestamp. Do not assume independently
rebuilt bytes are interchangeable: preserve the original verified bundle.

## Consumer trust boundary

A delivery consumer must validate the GitHub repository and workflow identity,
workflow_dispatch/main event, successful completed run, exact source SHA and its
unique release tag, and main ancestry. Artifact name or a user-supplied run ID
alone is not provenance. Reject PR/fork/failed/expired/ambiguous artifacts.

Verify the download against GitHub's artifact archive digest and then each file
against release.json. Enforce bounded expansion, regular files, safe paths and
no duplicate names; treat all bytes as data. Check frontend API origin against
the destination environment and JAR/marker version against the selected tag.
Production credentials must never execute downloaded source, npm hooks or shell
scripts. Build and delivery run with separate privileges.

Before changing delivery authority, the operator verifies that the currently
running backend source SHA, canonical frontend SHA and unique release tag agree.
Changes to runtime configuration/helper policy require a fresh verified off-host
recovery copy after the changes, while retaining the pre-change rollback copy.

The operator publishes backend, checks exact version/health, then frontend,
checks the release pair and records a receipt. Keep the preceding frontend
compatible during backend rollout and already-open tabs. Restarts discard
in-memory sessions. A failed or ambiguous publication needs bounded recovery,
not an automatic rerun.

After delivery verification, publish the GitHub Release for the existing tag and
attach these same three files. Keep known-good bytes and recovery receipts beyond
Actions retention. Expired artifacts are not permission to move a tag or replace
an immutable server artifact; prepare a new reviewed release when necessary.

## Transition

This PR proposes removing the old production workflows/instance files from the
public tree; their tested implementation and successor are maintained privately.
The current main remains unchanged until merge. **Merge this PR only in the
owner-approved cutover window**: drain/disable legacy entrypoints before merging,
then activate the reviewed private coordinator. Do not merge as an ordinary
preparatory docs/build update. Actions concurrency cannot lock repositories.

Git-based frontend previews and existing Root/Build/Output are preserved.
Generic app env examples remain public. Removing files does not erase history;
no tag, Release or history is rewritten.

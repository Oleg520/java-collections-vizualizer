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

Consumers must keep the preceding frontend and already-open tabs compatible
with a backend update. Version equality alone does not prove API compatibility.
Restarts discard in-memory sessions. Preserve known-good bundle bytes beyond
Actions retention; prepare a new reviewed release when a bundle has expired.
When publishing a GitHub Release for an existing tag, attach the same verified
`backend.jar`, `frontend.tar` and `release.json`. Production delivery is outside
this repository.

## Static hosting and previews

The frontend is static output from Vite. `frontend/public/_headers` provides
caching for content-hashed assets. Serve `index.html` for SPA navigation; do not
add a top-level `404.html`, catch-all redirect, Pages worker or functions.

The existing Cloudflare Pages project retains these Git preview build settings.
Commands and output paths are relative to the repository root:

| Setting | Value |
| --- | --- |
| Root directory | `/` (repository root) |
| Build command | `sh scripts/fetch-version-tags.sh && npm --prefix frontend ci && npm --prefix frontend run build` |
| Output directory | `frontend/dist` |
| Node version | Match `frontend/package.json` (22.12+ on 22, or 24+) |

Keep existing Git integration and preview settings when editing build scripts.
Preview builds do not implicitly grant API access. For an interactive hosted
preview set `VITE_API_URL` to a compatible API origin before building and allow
the exact preview origin in that backend's `ALLOWED_ORIGINS`. Wildcard CORS is
not supported. Without an API origin, static hosting needs its own `/api` proxy;
Vite's development proxy is not included in `dist`.

Local builds need no hosting account, credentials or environment file.
See [local startup](../README.md#быстрый-запуск), [API security](API_SECURITY.md)
and [diagnostics](OBSERVABILITY.md).

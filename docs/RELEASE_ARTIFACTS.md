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

## Static hosting and same-origin API

The frontend is static output from Vite; it needs no Node.js process in production.
For a site at `https://visualizer.devport.ru`, supply that exact value as
`api_origin` when dispatching **Build release artifacts**. The existing
`VITE_API_URL` setting is compiled into JavaScript; requests then use
`https://visualizer.devport.ru/api/v1/...`. Do not include `/api` or a trailing slash.
The manifest records this origin so delivery can reject a bundle for another target.
Changing a server environment variable cannot rewrite an already built frontend.

The operator serves `dist`, routes `/api` and `/api/*` to Java **without stripping
the path**, and returns `index.html` for SPA navigation. Keep API, `/release.json`,
and `/assets/*` outside the SPA fallback: missing assets/API must not return HTML.
Cache content-hashed assets immutably; revalidate HTML and disable caching for
`/release.json` and API responses. Hosting owns these headers; no Pages publishing
tool, `_headers` file, worker or functions are needed.

Keep preceding content-hashed assets available for open tabs and rollback.
Add the exact public site origin to backend `ALLOWED_ORIGINS`; the HTTPS origin
can still need explicit allowance when Java receives HTTP from the local proxy.
Retain previous allowed origins only for an agreed transition period. Wildcard
CORS is not supported. Never expose the separate management listener.

For local development, empty `VITE_API_URL` uses Vite's existing `/api` proxy.
That proxy is not included in production `dist`. Local builds need no hosting
account, credentials or environment file. See [local startup](../README.md#быстрый-запуск),
[API security](API_SECURITY.md) and [diagnostics](OBSERVABILITY.md).

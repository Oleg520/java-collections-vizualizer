# Application deployment contract

Java 21 backend and static frontend. Sessions live in memory; restart loses them.
Local development/build/testing requires no production repository or credentials.

Use [verified release artifacts](../docs/RELEASE_ARTIFACTS.md) and
[exact-tag versioning](../docs/VERSIONING.md) as the interface.
Environment instances, access, credentials, deployment and recovery belong to
the private operations repository. backend.env.example is illustrative app
configuration, never a production replacement. Preserve exact approved CORS
origins and necessary legacy origins.

## Cutover-sensitive merge

This PR removes old direct-production workflows and instance/helper files from
the public tree. Current main and production are unchanged until merge.
**Merge only during the owner-approved handoff**, after draining/disabling old
runs and preparing private recovery/delivery. Review with its companion operations
PR; do not enable two independent coordinators. No merge, disable, infrastructure
or credential change is performed by opening this PR.

The original imported deployment files/tests are preserved privately; application
CI retains all generic version/build/unit/E2E checks. Deletion does not erase
Git history, logs, forks or artifacts. Tag/Release 0.3.2 stay unchanged.

## Static serving and previews

frontend/public/_headers provides caching for content-hashed assets. Retain
native hosting headers and SPA fallback: no top-level 404.html, unnecessary
catch-all redirect, executable Pages worker/functions or second hosting project.
Keep existing Git integration/previews and Root/Build/Output. Production
publishing is controlled separately by the private coordinator. Preview API use
requires an approved exact origin or staging API; existing build previews do not
implicitly receive production API access.

Application diagnostics/proxy contracts remain in
[API security](../docs/API_SECURITY.md) and [observability](../docs/OBSERVABILITY.md).
The separate management listener must never become a public upstream.

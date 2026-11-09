# Application deployment contract

Java 21 backend and static frontend. Sessions live in memory; restart loses them.
Local development/build/testing requires no production repository or credentials.

Use [verified release artifacts](../docs/RELEASE_ARTIFACTS.md) and
[exact-tag versioning](../docs/VERSIONING.md) as the interface.
Environment instances, access, credentials, deployment and recovery belong to
the private operations repository. backend.env.example is illustrative app
configuration, never a production replacement. Preserve exact approved CORS
origins and necessary legacy origins.

## Delivery ownership

Public workflows test the application and build verified release artifacts.
Production release and rollback run only through the private operations
coordinator. Legacy direct-production entrypoints must be disabled and drained
before that coordinator is activated; concurrency cannot lock across repositories.
Production credentials belong only to the private protected environment.

Original deployment references/tests are preserved privately and in Git history;
application CI retains generic version/build/unit/E2E checks. Deletion does not
erase history, logs, forks or artifacts. Tag/Release 0.3.2 stay unchanged.

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

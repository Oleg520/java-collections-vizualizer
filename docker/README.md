# Verified Java runtime image

This packages the exact JAR already tested by application CI. It never runs Maven,
builds frontend assets, deploys, or accesses private infrastructure. Frontend remains
a separate static artifact. Runtime is pinned Temurin JRE 21 on Ubuntu Noble,
linux/amd64, user 10001:10001, immutable `/app/backend.jar`, API 8080 by default.
Actuator stays on container **loopback** 18083; do not publish it. No database,
application data volume, Node runtime or certificate-writing entrypoint is needed.

## Local check

Use a local Linux Docker daemon and build/test Java first with JDK 21:

```bash
./mvnw clean verify
python3 scripts/package-image.py --jar "$(sh scripts/backend-jar.sh)" \
  --revision "$(git rev-parse HEAD)"
```

An untagged build must contain that SHA in its snapshot version. For a tagged
release, provide `--manifest release-bundle/release.json` and the already-packaged
`release-bundle/backend.jar`; the original manifest must match bytes/source/version.
Output must not already exist. A temporary Docker context contains only Dockerfile
and JAR. There is no independent second Java build. No tag or Release is created.

The real-image smoke creates only a uniquely named disposable container/network.
It checks actual JAR digest, revision/version, loopback publishing, non-root,
read-only/no mounts, no-new-privileges, capabilities/seccomp, JVM memory/CPU/process
budgets, trusted proxy differentiation, forged-header quota rejection, management
isolation and SIGTERM. Where the daemon supports AppArmor, docker-default enforce
is checked; Docker Desktop cannot substitute for a production AppArmor acceptance.
These tests create sessions only in their own disposable backend.

## Artifact contract

The existing `release-SHA` artifact remains **exactly** backend.jar, frontend.tar,
release.json with schema 1. The same successful manual main release build now
publishes a separate **backend-image-SHA** artifact with exactly:

- `image.tar.gz`: docker-save bytes compressed with deterministic gzip timestamp.
- `image.json`: schema 1, repository, full `sha`, JAR build `version`,
  `jar_sha256`, `platform=linux/amd64`, pinned `base_image`, `image_tag`,
  `config_digest`, diagnostic `producer_image_id`, archive size/SHA-256,
  exact `bundle_manifest_sha256`, and `build` run_id/attempt/event.

`config_digest` hashes the actual config bytes in docker-save, not a potentially
store-specific `docker inspect .Id`. Both classic and OCI-backed stores are
supported. After loading, record the target-local ID and require the running
container to use it; verify config/source/JAR binding as well as the archive digest.
Base defaults (including its maintainer labels) are not application provenance.

Consumers verify the two GitHub artifact archive digests and the **same successful
trusted repository/workflow/main-dispatch/run/attempt/SHA**, exact release tag and
main ancestry. Then match image metadata to the original bundle manifest/JAR,
validate saved-image contents and runtime policy, and recheck provenance before
privileged activation. Reject PR/fork/local/failed/rerun/ambiguous artifacts.
Checksums included by a producer do not authenticate that producer on their own.
Do not replace the strict old bundle validator with one accepting arbitrary files.

PR CI packages an untagged snapshot solely for checks. It is not an eligible
release artifact. Keep original current/previous bundles, images and metadata
beyond Actions' 90-day retention; never rebuild on the target or deploy `latest`.
Future image rebuilds/base updates are separately reviewed immutable artifacts.

Runtime policy and delivery/recovery belong to the operator. A single-instance
restart loses in-memory sessions; health status is not automatic rollback.
An image does not make frontend/backend switching atomic. Preserve previous
hashed frontend assets and compatibility with old tabs during updates/recovery.

## Release identity before first activation

This PR creates no tag or technical release. An operator must explicitly select
the first eligible version after review. A technical patch is safe only if the
source diff from the last product release contains packaging/operations changes
and no unshipped product scope. Otherwise stop and agree a truthful version or a
separately verified source-artifact handoff. Do not silently retag an existing SHA
or label unreleased product features as a packaging-only patch.

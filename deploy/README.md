# Deployment overview

The public demo uses a static Netlify frontend and a Java 21 backend behind an
HTTPS reverse proxy. The backend stores sessions in memory; restarting it loses
sessions. Public API URLs are configuration, not credentials.

## Files and delivery contract

- `backend.env.example`: non-secret configuration example; use exact CORS origins.
- `java-collections-visualizer.service` and `java-collections-visualizer.caddy`:
  service and proxy configuration used by this project.
- `backend_deploy.py`: validates the artifact, atomically switches the release,
  checks local/public health, and rolls back on failure.
- `upload_backend.sh`: uploads the verified artifact with pinned SSH host identity.
- `tests/`: local fixtures for validation, rollback and upload cleanup.

The backend Actions workflow is **manual only** (`workflow_dispatch`) and accepts
`main` only. Pushes and pull requests do not deploy the backend. A build job runs
verification without SSH secrets; the delivery job uses that exact artifact and
checks its SHA-256. Releases are immutable: the same SHA with different bytes is
rejected. GitHub concurrency and a server lock serialize delivery.

The `backend-production` GitHub environment must restrict deployment to the
`main` branch before secrets are configured. It supplies `JCV_DEPLOY_SSH_KEY` and
`JCV_DEPLOY_KNOWN_HOSTS`; host identity must be verified through a trusted channel.
Keep credentials in the secret store, never in this repository. The deployment
account and privileged helper must retain their existing least-privilege boundary.

A failed health check triggers rollback and fails the workflow. Process termination
or failed rollback can require owner intervention. Host provisioning, access,
recovery and backup procedures belong in an access-controlled operator runbook.

## Frontend

`netlify.toml` builds `frontend/` and publishes `dist`. Netlify builds `main`
automatically. `VITE_API_URL` is the public backend origin, without `/api/v1`;
Vite embeds it at build time. A new API origin requires a frontend rebuild and a
matching backend `ALLOWED_ORIGINS` value. Preview origins are not allowed implicitly.

See [versioning and release procedure](../docs/VERSIONING.md),
[API limits and proxy trust](../docs/API_SECURITY.md), and
[local development](../README.md#быстрый-запуск).

## Local verification

These checks use temporary fixtures, without contacting production or SSH:

```bash
python3 -m unittest discover -s deploy/tests -v
bash -n deploy/upload_backend.sh
```


## Private backend diagnostics

Actuator uses a separate loopback listener (default `127.0.0.1:18083`, configured
by `MANAGEMENT_PORT`). Keep this port out of public proxy upstreams and firewall
rules. The Caddy example denies `/actuator` paths. See
[operator access and metric meanings](../docs/OBSERVABILITY.md) for local curl and
SSH forwarding. Applying these defaults to a running server requires the normal
reviewed deployment; this change does not perform a deployment.

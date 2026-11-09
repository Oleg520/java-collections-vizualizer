# Deployment overview

The public demo uses a static Cloudflare Pages frontend and a Java 21 backend behind an
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

## Frontend: Cloudflare Pages

Production: https://java-collections-vizualizer.pages.dev. The existing Git-integrated
Pages project is `java-collections-vizualizer`, production branch `main`.
The Java 21 backend on Selectel remains https://jcv-api.135-106-208-51.sslip.io.
Production 0.3.2 and its published GitHub Release are already verified; this
migration PR does not redeploy them or move the tag.

### Owner setup before merge (not performed by this PR)

1. Cloudflare dashboard → **Workers & Pages** → **java-collections-vizualizer** →
   **Settings → Builds & deployments → Configure Production deployments**.
   Keep production branch **main**, **uncheck Enable automatic production branch
   deployments**, and **Save**. Reopen the setting and confirm it is disabled.
   Do not disconnect GitHub or disable the whole build system.
2. In **Configure Preview deployments**, keep **All non-Production branches**
   (or custom rules including PR branches); do not select **None**.
   Confirm a PR update produces a preview without changing the production deployment.
   Disable any legacy Netlify automatic production publishing separately if still active.
3. Configure Pages Git preview builds: root directory `frontend`, build command
   `sh ../scripts/fetch-version-tags.sh && npm ci && npm run build`, output
   directory `dist`, environment variable `NODE_VERSION=22`. For preview builds,
   `VITE_API_URL` is the chosen backend HTTPS origin (without `/api/v1`);
   this value is public and is embedded by Vite. Do not put API tokens in Vite variables.
   Preview origins are **not** allowed by production backend CORS. A working
   preview API needs a separately approved exact origin or a staging backend;
   this PR neither adds preview origins nor changes the VDS.
4. GitHub repository **Settings → Environments → New environment**:
   create `frontend-production`. Under **Deployment branches and tags** choose
   **Selected branches and tags** and allow the branch `main` only (no tag rule).
   Add required reviewers where supported to review production dispatches.
5. Create a Cloudflare custom API token: permission **Account → Cloudflare Pages →
   Edit**, resources **Include → Specific account → the account owning this project**.
   No DNS, Workers, zone or account-wide administrator permissions are required.
   Pages token scope is account-level; use a dedicated token and rotate it per policy.
   In the GitHub `frontend-production` environment, add secrets
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for that account.
   No Cloudflare credentials are needed for PR CI or the verify job.
6. Record confirmation of steps 1–5 in the PR before merge. These external settings
   cannot be inferred from repository files and are **pending owner confirmation**.

The [branch controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)
and [CI upload guide](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
describe these settings. Wrangler can upload to the existing Git-integrated
project; do not create a second project or convert/disconnect Git integration.

### Manual production delivery

Run Actions **Deploy frontend manually → Run workflow → Branch: main** only
after tagging and successfully deploying the backend from the same SHA.
No push, PR, tag or Release event triggers this workflow. It checks out the
immutable dispatch SHA with all tags and requires exactly one plain `X.Y.Z`
release tag on that commit. Untagged commits, ancestor-only tags, ambiguous
release tags and non-main dispatches fail before publishing.

Verification runs TypeScript/Vite, unit tests, exact-tag regression fixtures,
Maven verification and both Playwright suites against an isolated local backend.
It then rebuilds with the production `VITE_API_URL` and uploads `frontend/dist`
as an Actions artifact. The environment-protected job downloads that artifact,
requires public backend health `UP`, Java `21`, and the same release version,
then publishes via pinned Wrangler to the existing project with `--branch=main`
and `--commit-hash=<dispatch SHA>`. Only this step receives Cloudflare secrets.
GitHub permissions are `contents: read`; the workflow concurrency group serializes
frontend production runs without cancelling an in-flight upload. GitHub may
replace an older pending run; dispatch and review only the intended release.
Cloudflare Git builds and dashboard actions are outside this lock, so disabling
automatic production builds is mandatory. Backend and frontend workflows have
separate locks: the owner must avoid overlapping release sequences or stale reruns.

### Static serving and recovery

`frontend/public/_headers` carries only the immutable one-year cache policy for
Vite's content-hashed `/assets/*`. Pages already provides
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
ETags and HTML revalidation; do not duplicate those settings.
With no top-level `404.html`, Pages supplies SPA fallback to the root for unknown
paths, so no catch-all `_redirects` is needed.
See [Pages serving defaults](https://developers.cloudflare.com/pages/configuration/serving-pages/)
and [headers syntax](https://developers.cloudflare.com/pages/configuration/headers/).

After publishing check the production deployment SHA, visible version, direct
navigation/reload on a nested path, headers, health, CORS preflight, session
creation and a collection operation. Keep the legacy Netlify origin in
`ALLOWED_ORIGINS` during transition; the example includes both exact origins.
Removing it is a separate approved production change.

For a failed frontend rollout, the owner can use Pages **Deployments → previous
known-good production deployment → Rollback** after checking compatibility with
the running backend. Do not rebuild or retag an old release, or blindly rerun an
older workflow against a newer backend. Rollback and production checks are manual
owner operations, not performed by opening this PR.

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

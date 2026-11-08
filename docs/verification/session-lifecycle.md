# Session lifecycle investigation for 0.3.1

Investigation date: 2026-11-08. No production configuration, service, release,
repository settings or deployment was changed during this investigation.

## Confirmed causes

The 0.3.0 UI issued POST /sessions on every collection switch, new-list action
and explicit session recovery. SessionStore retained each entry until inactivity
TTL; switching dropped the client's reference without retiring the server entry.
With MAX_SESSIONS=32 and automatic per-client sizing, the live limit is 8/IP.
This reproduces CLIENT_SESSION_LIMIT even when requests are spaced across windows.

Read-only inspection of the running backend confirmed the relevant production
settings: MAX_SESSIONS=32, automatic per-client sizing, SESSION_CREATE_RATE_LIMIT=6,
WORK_RATE_LIMIT=120, RATE_WINDOW_SECONDS=60, and one concurrent work request/IP.
A separate create-rate budget is consumed before MVC, including admitted creations
that later fail live-quota validation. Repeated switches/recovery attempts can
therefore exhaust six creations in a minute and return RATE_LIMITED before reaching
the eight-live-session limit. RATE_LIMITED does not identify which individual
person consumed a shared IP budget. Historical counters/request attribution were
not available, so the second user's specific incident cannot be assigned to a
particular burst, NAT, or proxy misidentification.

## Proxy hypothesis: not confirmed

The running Java process trusts only the configured loopback proxy literals.
The backend listener is IPv4-mapped loopback, which ClientAddress normalizes.
The on-disk application Caddy route overwrites the custom client header with the
socket's remote host, and the main Caddy configuration imports that route.
No evidence of a missing TRUSTED_PROXIES setting or an exposed backend listener
was found. Arbitrary client Forwarded/X-Forwarded-For headers are ignored.

The Caddy admin endpoint could not be queried. Consequently, the loaded runtime
route and the resolved identities of two historical external users were not
independently observed. The owner should verify that the running route matches
the reviewed file and overwrites duplicate/spoofed custom headers, and compare
resolved identities from two genuinely distinct network clients using approved,
privacy-preserving diagnostics. Shared NAT addresses legitimately share quotas.
No change to proxy trust is justified by the available evidence.

## Fix and remaining limits

A tab reuses one UUID; an owned, revision-checked POST /sessions/{id}/reset
atomically replaces its structure. A serialized frontend connection retains
committed revisions from obsolete replies while generation checks protect the UI.
Queued obsolete switches are coalesced. Lost resets/commands are recovered by GET,
never retried automatically. An expired/missing reset target can be created anew.

There is no create/delete race and no new DELETE capability. Closing/reloading a
tab, IP changes and a lost create reply with an unknown UUID can still leave a slot
until TTL. Multiple tabs, abusive reset traffic, NAT users, and real work bursts
remain bounded by unchanged quotas. Existing UUID access for legacy commands is
preserved; reset additionally checks the IP owner. This is not authentication.

## Regression checks

- Java: quota-preserving switches, constructor changes, ownership, TTL, validation,
  replay/concurrent command/reset conflicts, distinct trusted-proxy clients,
  malformed/duplicate/untrusted headers and separate create/work budgets.
- Frontend: serialized and stale requests, coalesced switches, lost reset/command
  replies, conflicts, expired slots, no automatic retry of lost creation or 429.
- Browser: the complete HashMap/ArrayList suite plus a dedicated lifecycle suite
  with 32 total sessions, automatic 8/IP, 6 creations and 120 work requests/minute.
  The latter asserts one creation across repeated switches/new lists, isolation of
  tabs, delayed/lost replies, and genuine creation-budget rejection.

Run `./mvnw clean verify`, `npm --prefix frontend run build`,
`npm --prefix frontend test`, `npm --prefix frontend run test:e2e` and
`npm --prefix frontend run test:e2e:lifecycle`. The lifecycle runner starts a fresh
local backend with strict budgets and does not reuse the broad-suite backend.

## Follow-up review of 27577c4: rolling deployment compatibility

Only an ApiError with HTTP 404 **and** code SESSION_NOT_FOUND proves that a known
owned slot is unavailable. A missing /reset route on an older backend, HTML proxy
404, or generic 404 during command/recovery GET must preserve the UUID. Such errors
are surfaced; no replacement creation or automatic mutation retry is performed.
The UI explains version/routing incompatibility. Switching back to the slot's
known collection permits legacy commands while keeping the error actionable.

Deploy the compatible backend before publishing the new frontend. The old frontend
can use the new backend's legacy endpoints, but continues its old allocation
behavior until refreshed. A new frontend against an old backend cannot switch or
reconfigure a slot safely; it fails visibly instead of falling back to creation.
A backend restart expires in-memory sessions; the new backend's explicit
SESSION_NOT_FOUND then permits one replacement. Network failures/409 followed by
an unrecognized recovery GET 404 never discard a known UUID.

Read-only version/release check on 2026-11-08:

- Latest published GitHub Release: 0.2.1; the 0.3.0 Release remains a draft.
- Existing immutable tag 0.3.0 points at d73f0d9e26529dbd0ffb921055f7f25403340737.
- Production health and the published frontend bundle both report 0.3.0.
- Netlify's attempted production build for 27577c4 was not published because the
  account credit quota was exhausted. This must be resolved by the owner before
  a future frontend release can be verified; this work changes no hosting settings.
- Next unused patch version: 0.3.1. Do not reuse or move 0.3.0 just because its
  GitHub Release is still a draft. No tag/release/deploy is part of this fix.

The repository's existing automatic Netlify builds on main can publish the frontend
before a separately dispatched backend rollout. The owner must coordinate this
window: the fix safely reports incompatibility, but cannot make an old backend
implement /reset. There is intentionally no version-string-based fallback or
create-on-error workaround. The temporary local-only Playwright configuration
that disabled managed test servers has been removed; CI uses the isolated runners.

# Session lifecycle investigation for 0.3.1

Local regression analysis for the session reuse fix introduced in 0.3.1.
This document records the failure mechanism and reproducible checks.

## Confirmed causes

The 0.3.0 UI issued POST /sessions on every collection switch, new-list action
and explicit session recovery. SessionStore retained each entry until inactivity
TTL; switching dropped the client's reference without retiring the server entry.
With MAX_SESSIONS=32 and automatic per-client sizing, the live limit is 8/IP.
This reproduces CLIENT_SESSION_LIMIT even when requests are spaced across windows.

A reproducible strict local configuration uses MAX_SESSIONS=32, automatic
per-client sizing, SESSION_CREATE_RATE_LIMIT=6, WORK_RATE_LIMIT=120,
RATE_WINDOW_SECONDS=60 and one concurrent work request/IP. The create budget
is consumed before MVC, including admitted creations later rejected by live
quota validation. Repeated creation attempts can exhaust six creations/minute
before reaching eight live sessions. Users behind NAT share the same IP budget.

Arbitrary Forwarded/X-Forwarded-For headers are ignored. Proxy trust and header
validation are covered by [API security](../API_SECURITY.md); do not broaden
trusted proxies to compensate for session accumulation.

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

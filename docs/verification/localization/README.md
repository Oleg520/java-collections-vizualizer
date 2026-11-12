# RU/EN local visual review — Issue #9

Status: implementation ready for owner visual review; **owner approval pending**.
Source: `feat/ru-en-localization`, frontend implementation `4cdd796`, targeted E2E
`156ce7c`; Java event metadata/fixture `eeeb68d`. Captured 2026-11-12 against Vite
development UI and the real Java backend. No production build/deployment is implied.

Both RU/EN buttons remain visible in the header, with `aria-pressed`, native
keyboard interaction and a restrained active background. The persistent engine
connection indicator was removed; health/protocol checks and error recovery remain.

| Collection | Desktop RU | Desktop EN | Mobile RU | Mobile EN |
|---|---|---|---|---|
| HashMap resize/split | [1440×900](desktop-hash_map-ru.png) | [1440×900](desktop-hash_map-en.png) | [412×839](mobile-hash_map-ru.png) | [412×839](mobile-hash_map-en.png) |
| ArrayList growth/copy | [1440×900](desktop-array_list-ru.png) | [1440×900](desktop-array_list-en.png) | [412×839](mobile-array_list-ru.png) | [412×839](mobile-array_list-en.png) |

Additional narrow and short desktop captures:

- HashMap: [320×740](narrow-hash_map-en.png), [1440×720](short-hash_map-en.png).
- ArrayList: [320×740](narrow-array_list-en.png), [1440×720](short-array_list-en.png).

The screenshots show actual intermediate Java frames: `BUCKET_SPLIT` and the last
`ARRAY_COPY_COMPLETED` of the growth scenario. Diagrams/inspector retain bounded
internal scrolling. Only source protocol tokens, Java notation, brand names and
scenario input data intentionally remain unchanged. [Layout observations](layout.json)
record no document horizontal overflow, no page errors and no Russian prose in
the sampled EN flows. These checks do not establish exhaustive language/UI coverage.
Screenshots were inspected for header placement, labels, wrapping and preserved
workbench structure; the automated fixture/catalog checks provide broader text
coverage beyond these sample frames.

## Targeted validation

- TypeScript `tsc -b`: passed.
- Vitest: 87 tests in the 10 affected locale/presentation/detail/session/API files
  passed. Catalog key/placeholder parity, 17 standard scenario IDs, validation
  reasons, all real Java fixture variants, user data escaping and unknown data
  fallbacks are included.
- Java: `LocalizationMetadataTest`, `SerializationContractTest`,
  `LocalizationEventContractTest`: 5 tests passed. Formatter apply ran for the
  changed Java files through the repository root profile.
- Playwright `localization.spec.ts`: 12 passed (desktop + mobile). This includes
  old-operation history, forms, selection, zoom, constructor/diagram settings,
  active playback timing, in-flight reply, cooldown translation, metadata,
  persistence and keyboard switching at 320 px.
- Playwright technical-details regression from `workbench-polish.spec.ts`:
  2 passed (desktop + mobile), including nested elements/results/null/long values.

A repeated local run hit `CLIENT_SESSION_LIMIT` after accumulated test tabs.
The local test backend was restarted using the existing broad E2E configuration
(MAX_SESSIONS/MAX_SESSIONS_PER_CLIENT/SESSION_CREATE_RATE_LIMIT 256,
WORK_RATE_LIMIT 5000); the rerun passed. No production configuration was changed.
The manual-review backend is restarted with ordinary defaults afterward.

Full final validation, production frontend build, complete E2E and strict lifecycle
suite are intentionally deferred until explicit owner visual approval. Existing
RU test selectors were updated for localized tabs/field labels; the full suite has
not yet been rerun. Chromium was used; other browser engines remain unverified.
No push, PR, merge or deployment has been performed.

## Manual review

Open http://localhost:5173 with backend health at
http://localhost:8080/api/v1/health.

1. Run HashMap resize/tree scenarios. Switch RU/EN during playback, then while
   paused on an earlier history entry. Check speed, cursor, zoom, selected node,
   physical links and inspector tab.
2. Switch to ArrayList, run automatic growth and middle insertion/removal. Inspect
   old/new buffers and null versus a free slot. Select a cell and constructor;
   switch language without creating a new list.
3. Enter an invalid index or Integer. Switch language with the error still open;
   check translated recovery text and unchanged input data.
4. At 320/412 px, use both language buttons by keyboard and touch; check labels,
   focus, header spacing and internal scrolling. Reload after selecting English
   to check language persistence (session/history still follow normal reload rules).

After visual feedback, iterate locally. Only after approval run the required final
checks, push and open one PR with `Closes #9`; merging/deployment require separate
owner authorization.

# Issue #9 final local validation

Owner visual approval: 2026-11-12. Implementation: `a108718` plus the final
keyboard-order test update; later documentation records the results. The approved
rendered UI did not change during finalization.

| Check | Result |
|---|---|
| Java formatter apply, then check | Passed; no unintended Java changes |
| `./mvnw clean verify` on JDK 21 | 24 core + 61 backend tests passed; backend JAR built |
| `npm ci`, frontend production build | Passed, strict TypeScript included |
| Complete Vitest suite | 131 passed in 15 files |
| Python script/tooling/release contracts | 20 passed |
| Production Playwright, desktop/mobile | 125 passed, 7 expected skips (3.3 min) |
| Development scenarios + updated keyboard order | 10 passed |
| Fresh backend with standard limits | 14 passed |
| Strict-quota/lifecycle desktop/mobile | 2 passed |
| `git diff --check` and changed documentation local links | Passed |

Finalization fixed two issues found by the checks:

- The production bundle guard rejected unconditional dev-scenario translation
  metadata. Those entries are now gated by `import.meta.env.DEV`; the existing
  guard still rejects accidental publication of local scenario IDs. Production
  and development keep their approved rendered text.
- Existing keyboard-order assertions expected collection → GitHub. They now check
  collection → RU → EN → GitHub and the reverse order, preserving focus checks.
  The localization test also uses the English Algorithm name while EN is active.

## Quotas and isolation

The standard-limit browser run used a fresh backend with **no quota environment
overrides**, ordinary production defaults from `application.yml` (128 sessions,
automatic 32 sessions/client, 30 creations and 600 work requests/window). Its 14
checks covered both collections, old history, user inputs, selection/zoom,
playback timing, in-flight replies, errors/cooldown, persistence, metadata,
keyboard use and recovery after a lost committed response.

The complete E2E and development batches use the repository's existing broad test
fixture: 256 sessions/client slots and creations, 5000 work requests. These limits
allow many independently mounted test tabs; they were **not** used for the
standard-limit or strict lifecycle checks. No application defaults were raised.

Strict lifecycle used its existing settings exactly: `MAX_SESSIONS=32`,
`MAX_SESSIONS_PER_CLIENT=0` (automatic), `SESSION_CREATE_RATE_LIMIT=6`,
`WORK_RATE_LIMIT=120`, trusted local proxy addresses. Repeated collection/constructor
changes, delayed responses and lost replies kept one server slot per mounted tab.

In this local environment, probes of closed localhost ports sometimes timed out
instead of refusing the connection, stalling Playwright server startup. For the
strict run, dedicated servers were started externally with the exact strict
settings. A temporary config imported `playwright.lifecycle.config.ts` and removed
only `webServer` orchestration; tests and assertions were unchanged. The checked-in
CI/lifecycle configuration was not modified. Standard and broad runs reused their
separate, explicitly configured servers. Linux browser libraries were supplied
through the existing local `LD_LIBRARY_PATH`; no dependency was added to the repo.

## Publication handoff

User untracked `AGENTS.md`, ArrayList verification files and workbench wrap-fix
artifacts were preserved. One branch and one PR target `main` with `Closes #9`.
Per the owner's latest instruction, GitHub CI is **not monitored after opening the
PR**; the owner will inspect it and perform code review. No merge, release, tag,
production deployment or live-infrastructure operation is authorized/performed.

Limitations: browser tests use Chromium desktop/mobile emulation; other engines
are unverified. Language persistence depends on localStorage (with in-memory
fallback); normal session/history loss on page reload is unchanged. Multilingual
URL/SSR indexing remains outside scope. The full production suite intentionally
skips development-only cases and a desktop-only sidebar case on mobile; the
applicable development cases are checked separately.

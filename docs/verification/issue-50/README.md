# ArrayList animations and compact workbench (#50)

The owner reviewed and approved the local desktop/mobile layout, centered metrics,
and the final result-timing adjustment on 2026-11-11. This change continues the
animation prototype in `7be8c56` on `fix/50-arraylist-cell-animations`.

Physical ArrayList slots keep their buffer/index identity and fixed 96 px height.
Block shifts and copies use source/destination highlights from Java events.
Pending-buffer promotion preserves DOM, keyboard focus and selection. No reference
flight or synthetic Java execution steps were added. The unallocated array message
is restored to the top of the pane.

The header groups Visualizer, version and collection navigation at the left;
mobile hides breadcrumb ancestors and 320 px hides the brand word. Constructor,
centered metrics and command inputs share one panel. HashMap reuses the layout
without a constructor placeholder. The visible action is `Выполнить`, retaining
operation context in its accessible name.

`Результат операции` contains a neutral `—` until the selected trace's **last**
frame. Earlier `OPERATION_COMPLETED` frames inside a scenario do not reveal its
final result. Backward seek, replay and history selection hide it again; the same
Java result reappears on the final frame. False, zero, null and void remain valid
results. Snapshot status is plain contextual text in the player, with no badge
beside the result or separate server size/revision row. Session/revision and
recovery logic are unchanged.

At 1440×900 and 1440×720, controls, visualization/player and the right inspector
fit the viewport. Very short desktop windows and mobile retain ordinary document
scrolling; larger structures scroll inside the diagram. The desktop grid uses an
intrinsic control row and a bounded remaining row, so short-window overflow also
extends the sidebar's containing block. This fixes a validation finding without
changing the approved 900/720 px geometry. Pane height stays constant across trace
frames. Player explanation shares the transport row, wraps on phones, and retains
the complete keyboard-readable text and inspector information.

## Approved rendered examples

- [Desktop, pending result](desktop-arraylist-pending.png)
- [Desktop, completed ArrayList trace](desktop-arraylist-complete.png)
- [Desktop HashMap](desktop-hashmap.png)
- [412 px mobile](mobile-412.png)
- [320 px mobile](mobile-320.png)

These are a curated evidence set; raw investigation recordings and transient local
harnesses are deliberately excluded.

## Validation

- Java 21 `./mvnw -B verify`: passed, 81 tests.
- Read-only IntelliJ formatting/Git-version check: passed.
- Python tooling tests: 20 passed.
- Frontend production build (strict TypeScript + Vite): passed.
- Frontend unit tests: 94 passed, including result gating, rewind, scenario
  intermediate completion and falsy Java results.
- Chromium production E2E: 107 passed, 5 intentional skips (development-only
  scenarios and the desktop sidebar test on mobile).
- Development-mode local split/preparation scenarios: 6 passed.
- Strict-budget session lifecycle: 2 passed (desktop/mobile).
- Prettier, Markdown local links and `git diff --check`: passed.

E2E server-state assertions now read the real Java session and compare its revision
with a reply observed by the browser. They no longer depend on a removed server
row, and are not redirected to the displayed historical snapshot's size. API
reads wait for the UI's mutation to finish, preserving strict admission behavior.
New regression coverage asserts physical slot counts, immutable Java cell contents,
DOM identity through promotion, pane/cell geometry, 4×/rapid seek and result timing.
Existing responsive, keyboard, navigation, recovery and session tests were updated
to the approved header/player layout.

Local validation uses an isolated Java service on :18080 and Vite production/dev
servers on :14173/:15173, with the same broad-suite or strict lifecycle budgets as
the repository Playwright configs. Temporary configs only redirect ports/origins;
no production limits or live infrastructure were modified. The user preview on
:5173/:8080 is retained separately. Physical devices, Firefox/Safari and manual
screen-reader testing were not performed.

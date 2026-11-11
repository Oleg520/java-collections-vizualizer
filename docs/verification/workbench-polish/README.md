# Compact workbench and selector polish (#52)

Verified locally on 2026-11-11 against the real Java 21 backend and the production
Vite bundle, with Chromium desktop/mobile projects. No production service or
production configuration was changed.

The global sticky application header contains `Collections → Map → HashMap ▾`
or `Collections → List → ArrayList ▾` between the brand and connection/GitHub
controls. Collections means Java Collections Framework. There is no duplicate
breadcrumb row in main or collection selector in the sidebar. The model label/help
sits compactly above the operation controls; the source link remains in Algorithm.

Desktop header height remains 76 px. On phones the same header uses two rows
(106 px) so navigation, brand and GitHub remain accessible at 320 px. The initial
1440×900 HashMap diagram and Events inspector start at 417 px. The diagram remains
832×576 px; visualization/inspector sizing and animation behavior are unchanged.
The sidebar starts with one row containing a 12 px scenario heading and an
icon-only collapse button. The collapsed rail keeps its accessible expand button.
Independent list scrolling and the educational footer are preserved. Mobile
retains the horizontal scenario strip and ordinary page scrolling. Empty-state
balance and canvas navigation remain separate work in #50 and #65.

| View | Screenshot |
| --- | --- |
| 1440×900, initial HashMap | [Desktop workbench](desktop-hashmap.png) |
| Global-header collection picker | [Desktop menu](desktop-menu.png) |
| Icon-only expand button in the collapsed rail | [Collapsed sidebar](desktop-sidebar-collapsed.png) |
| ArrayList, compact constructor row, nested ELEMENT result | [Desktop ArrayList](desktop-arraylist.png) |
| 320×740, wrapped ArrayList constructor | [Narrow ArrayList](mobile-arraylist.png) |
| 320×740, initial HashMap | [Narrow workbench](mobile-320.png) |
| 320×740, collection picker | [Mobile menu](mobile-menu.png) |
| 412 px, nested result and quoted string | [Mobile technical details](mobile-details.png) |

The ArrayList constructor is always visible in a compact row above ordinary
operations: a standard New list label sits above the 230 px dropdown, with
Create list to its right. Controls wrap on phones. The muted caption below the
constructor row explains that creation replaces the current list and clears
history. Scenario reset guidance is available in button tooltips and accessible
descriptions; collection replacement guidance is in a compact help disclosure
and the selector's accessible description. The help closes on mouse leave, an
outside click, Escape or keyboard focus leaving it; touch can open/close it without
hover. Neither action adds a confirmation step or changes request/session semantics. The only actionable OpenJDK source
link is in Algorithm and follows the active collection.

Technical details use nested description lists and ordered lists. All Java fields
remain visible, including result kind, false/zero and explicit nulls; strings stay
quoted so the string `"null"` differs from null. Long content wraps inside the
existing independently scrollable details pane. No new inspector sizing behavior
or collection algorithms were added.

## Validation

- `./mvnw -B clean verify`: 81 Java tests passed; backend JAR built.
- `./mvnw -B -Djava.format=check validate`: passed.
- `python3 -m unittest discover -s scripts/tests -v`: 20 passed.
- `npm --prefix frontend test`: 89 passed, including 16 structured-value cases.
- `npm --prefix frontend run build`: strict TypeScript and production bundle passed.
- Prettier check on changed frontend files and `git diff --check`: passed.
- Local focused Playwright (`workbench-polish.spec.ts` + `workspace.spec.ts`):
  21 passed, 1 intentional desktop-only sidebar test skipped on mobile.
- Complete collection, playback, recovery, development split and strict session
  lifecycle suites run in the existing GitHub Actions verify job. See the
  [PR checks](https://github.com/Oleg520/java-collections-vizualizer/pull/69/checks)
  for results tied to the final commit.

The new Playwright coverage checks pointer/touch and keyboard selection,
Escape cancellation, focus after closing, accessible names/descriptions,
collection-specific source links, constructor replacement/history clearing,
BOOLEAN/ELEMENT results and ELEMENT_READ, nulls and long escaped strings. It
checks 1440×900, 412×839 and 320×740, with no horizontal overflow. Global header
placement, visible actions and sticky navigation are also checked at
1024/768/681/680 px, after page scrolling and with keyboard Tab/Shift+Tab. Existing suites
cover playback, revision/recovery, scenario behavior, sidebar scrolling/collapse,
zoom preservation, reduced motion and the inspector splitter.

## Limits

The selector enhancement uses browser-owned HTML select behavior with
[`appearance: base-select`](https://developer.chrome.com/docs/modern-web-guidance/guides/forms/branded-select-styling).
Supported browsers receive the themed top-layer picker; other browsers retain
their system picker with dark color-scheme and a styled trigger. There is no JS
menu implementation or added dependency. Native fallback popup appearance remains
OS-dependent.

Browser interaction and screenshots were verified in Playwright Chromium,
including emulated touch. Physical devices, Firefox/Safari and manual screen-reader
sessions were not tested. Accessible roles/descriptions, keyboard focus and
navigation were checked in Chromium; these checks do not replace assistive
technology testing. Docker packaging is checked by the existing CI docker job.

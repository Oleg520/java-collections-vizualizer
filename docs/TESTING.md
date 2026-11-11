# Проверки и измерения

Установите зависимости по [быстрому запуску](../README.md#быстрый-запуск).
Для тестов также нужны Python 3 и Chromium (устанавливается Playwright).

```bash
./mvnw clean verify                   # core + API + исполняемый JAR
npm --prefix frontend test            # Vitest: transport, layout, presentation, session
npm --prefix frontend run build       # strict TypeScript + Vite production
cd frontend
npx playwright install --only-shell chromium
npm run test:e2e                       # backend и Vite запускаются автоматически
E2E_PREVIEW=1 npm run test:e2e          # тот же E2E против production dist, порт 4173
```

Playwright запускает исполняемый JAR из `backend/target` напрямую через Java,
поэтому перед E2E нужен `./mvnw clean verify`, в том числе после изменений Java
или смены Git-коммита/тегов. JDK выбирается через `JAVA_HOME` либо `java` в PATH.
Для этих тестов установка модулей через `install` не требуется.
Playwright также может использовать уже запущенные серверы на 8080/5173;
для CI требуется свободная пара 8080/4173 (production preview).
`--only-shell` скачивает только Chromium headless shell для текущих headless-тестов.
Если на локальной Linux-машине не хватает системных библиотек, один раз выполните
`npx playwright install-deps chromium` (может требовать административных прав).
Для headed/debug-запуска установите полный браузер: `npx playwright install chromium`.
Тесты работают с настоящим Java API. В recovery/compatibility регрессиях Playwright
контролируемо прерывает доставку ответов или подменяет ошибки proxy/API; штатные
команды и восстановление читают настоящий backend.

Покрыты детерминированные случаи и 2400 псевдослучайных операций против
`java.util.HashMap` на Java 21. После каждой проверяются уникальность ключей/ID,
индексы, цепочки, parent/left/right/prev, чёрный корень, отсутствие красного
родителя у красного узла и одинаковая чёрная высота. Отдельно проверяются
переходы list/tree, split на две половины, видимость узлов в рабочих снимках,
стабильность ID, сохранность предыдущих снимков и результат trace.

Все восемь сценариев HashMap проверяются при initialCapacity 0/16/32/64. E2E также
проверяет большой split на 97-й вставке, конфликт revision и offline-воспроизведение.
Обычный прогон не меняет скриншоты документации; для их обновления:
`UPDATE_SCREENSHOTS=1 npm run test:e2e` (из frontend).

Измерение ресурсов на отдельном локальном тестовом backend (создаёт 19 сессий,
исполняет большие split и два пакета параллельных сценариев):

```bash
java -Xms64m -Xmx256m -jar "$(sh scripts/backend-jar.sh)"
# В другом терминале; Python 3, без дополнительных пакетов:
python3 scripts/profile.py --pid JAVA_PID --jcmd "$JAVA_HOME/bin/jcmd"
```

`--pid` и `--jcmd` необязательны; для RSS и retained heap нужны Linux / локальный
JDK. Проба вызывает GC только при явном указании jcmd. `--encoding full` позволяет
сравнить старый формат, если отдельный локальный backend запущен с
`ALLOW_FULL_TRACE=true`. В публичном процессе этот режим оставляйте выключенным.
Вывод: `docs/verification/resource-profile.json`.
Результаты и границы измерений: [ресурсные измерения](verification/README.md).


Проверки версии и упаковки релизных артефактов без доступа к серверу:

```bash
python3 -m unittest discover -s scripts/tests -v
```

Команды выполняются из корня репозитория, кроме явно отмеченных команд frontend.

## ArrayList regression coverage

The existing Maven, Vitest and Playwright commands now cover both collections;
CI runs these same commands. `ArrayListEngineTest` compares 10,000 seeded operations
with a real Java ArrayList without reflection, including nulls, duplicates,
Integer boundaries, Unicode, get/set/remove results and invalid indices.
Separate fixtures check capacity (default/zero/positive, 10→15→22), marker
preservation, shifts, stable occurrence IDs, tail clearing, snapshot immutability,
resource rejection and all nine scenarios.

`ArrayListApiTest` checks compact round trips for every frame, full-trace rejection,
JSON integer validation, session isolation, concurrent revision conflicts and TTL.
`ApiIntegrationTest` also checks explicitly enabled full ArrayList traces. A search
at 128 elements / capacity 256 with 128 escaped NUL characters per value must stay
below 256 KiB in compact form and be at least 10 times smaller than full JSON.

`arrayTrace.test.ts` checks buffer sharing and rejects malformed references.
`arraylist.spec.ts` runs real Java commands and all scenarios on desktop/mobile,
checks old/new grow buffers, null versus empty, playback without mutations,
constructor changes, lost responses, 409 recovery, switching during a request,
320px width, reduced motion and HashMap treeification after ArrayList.

```bash
npm --prefix frontend run test:e2e -- arraylist.spec.ts
UPDATE_SCREENSHOTS=1 npm --prefix frontend run test:e2e -- arraylist.spec.ts
```

The screenshot command updates `docs/arraylist-desktop.png` and
`docs/arraylist-mobile.png`. No production service is involved.

## Встроенное управление воспроизведением (#67)

`playback.spec.ts` проверяет встроенный плеер непосредственно под ограниченной
областью диаграммы на desktop/mobile, при росте дерева, копировании ArrayList,
прокрутке страницы и изменении размеров окна. Проверяются полная ширина
центральной колонки, обычный поток документа, стабильная высота страницы при
переключении шагов, сворачивание без потери trace/cursor/playing, работа истории,
клавиатурное управление, touch, длинные пояснения и `prefers-reduced-motion`.
Плеер не перекрывает визуализацию и инспектор; дополнительный резерв под
плавающую карточку больше не нужен. Тесты используют настоящий Java backend.
Скриншоты в `verification/playback-dock/` документируют историческое
состояние PR #64 до перехода на встроенный плеер.

```bash
E2E_PREVIEW=1 npm --prefix frontend run test:e2e -- playback.spec.ts
```

## Стабильное рабочее пространство (#59)

`workspace.spec.ts` проверяет 1440×900, короткий desktop, 412×839 и 320×740:
короткий/длинный trace, 2/7 технических полей, выделение таблицы и рост дерева,
Events/Algorithm и раскрытый/свёрнутый встроенный плеер не меняют размеры диаграммы и инспектора
при переходах между шагами. Сравниваются фактические высоты документа и панелей.
Проверены независимая прокрутка sidebar колесом, закреплённые верх/низ, последний
сценарий, сворачивание клавиатурой, сохранение zoom/history/cursor/playing и
выравнивание встроенного плеера с центральной колонкой. Mobile сохраняет горизонтальный список без узкой rail; вертикальный touch-свайп
по этому списку продолжает прокручивать документ.

Разделитель проверяется реальным mouse drag и Chromium touch input, стрелками,
Home/End и ARIA-значениями. Последние события, технические поля и ссылка OpenJDK
должны оставаться доступны при крайних пропорциях, а высота документа — прежней.
ArrayList проверяется с двумя буферами и выбором последней ячейки внутри одной
области прокрутки. Варианты reduced motion и отсутствие перекрытий также покрыты
`playback.spec.ts`. Один desktop-only sidebar test намеренно пропущен в mobile.
[Итоговые скриншоты и границы проверки](verification/workspace/).

```bash
E2E_PREVIEW=1 npm --prefix frontend run test:e2e -- workspace.spec.ts playback.spec.ts
```

## Session lifecycle regression

`npm --prefix frontend run test:e2e:lifecycle` uses a separate Playwright config
and a fresh local backend with strict 6 creations/minute, 8 live sessions/IP and
120 work requests/minute. Stop any manually running backend/frontend on the test
ports first; reusing the broad-suite server would hide the original failure.
CI runs this suite after the complete collection regression suite. No production
limits are changed. See [the investigation](verification/session-lifecycle.md).


`session-compatibility.spec.ts` covers a missing /reset route (HTML 404) and
confirmed SESSION_NOT_FOUND, including explicit user retries, switching back to
legacy commands, actionable UI errors and exact creation counts. Unit tests also
cover generic 404 during command and recovery GET; neither may retire a known UUID.


## Backend observability

`./mvnw clean verify` includes lifecycle/streaming metric tests and a real HTTP
test of separate application/management listeners. Local access, metric
semantics and the local baseline/candidate comparison are documented in
[backend diagnostics](OBSERVABILITY.md). No public management route or production
load test is required.

## Совместимость сериализации

`dto/SerializationContractTest` сравнивает фиксированные запросы, ошибки, состояния
и full/compact trace обеих коллекций с `backend/src/test/resources/contracts/wire-current.json`.
Эталон получен на main после PR #38 (`350b653`) и проверен до и после переноса типов.
Сравнение JSON учитывает значения, null и порядок массивов; порядок полей объектов свободный.

## Frontend error recovery (#27)

`api.test.ts` checks Russian error messages, non-JSON failures, Retry-After seconds
and HTTP dates, invalid JSON, and a deadline covering a stalled response body.
`sessionConnection.test.ts` checks failed reconciliation after network/409/5xx,
blocking further mutations until GET succeeds, cooldowns including recovery GET,
retaining known UUIDs, and suppressing queued creation after a lost create response.

`session-recovery.spec.ts` runs on desktop and mobile for both HashMap and ArrayList:
committed POST delivery loss plus failed GET, explicit non-destructive refresh,
409 while old playback exists, 429/503 cooldown without automatic requests, retained
history/state, and exact creation/reset/command counts. Additional cases cover
initial backend failure, SESSION_NOT_FOUND (expiry or restart), and a real 15-second
browser timeout after Java commits. `session-compatibility.spec.ts` continues to
check generic route 404 versus confirmed expiry. UI errors are inspected at desktop
and mobile sizes; command blocking must not leave a loading spinner running.

Run the normal Vitest/build, complete production-preview E2E, and strict lifecycle
commands above. These regressions run in the existing GitHub Actions verify job.

## Компактный workbench и селекторы (#52)

`workbench-polish.spec.ts` проверяет единственный selector в breadcrumbs Map/List
слева под глобальным header, небольшой промежуток перед dropdown,
подсказку модели рядом с GitHub и отсутствие selector в глобальном header,
sidebar со сценариями, ссылки OpenJDK активной коллекции только в Algorithm,
сброс содержимого/истории через отдельный конструктор, вложенные BOOLEAN/ELEMENT
результаты и ELEMENT_READ с длинными строками/null без горизонтального overflow.
Проверяются mouse/touch, выбор клавиатурой, Escape без смены значения, видимый
клавиатурный фокус и отсутствие оставшейся mouse-подсветки, accessible names и
descriptions. Подсказка проверяется при уходе мыши, внешнем клике, Escape,
переходе Tab и touch, а конструктор — как постоянно видимая строка.
Viewports: 1440×900, 412×839 и 320×740; компактная строка дополнительно проверяется
на ширинах 1024/768/681/680 px, после прокрутки и при смене коллекции. `DetailValue.test.tsx`
проверяет false/zero/null, типизированные результаты, массивы и HTML escaping.
Существующие workspace/playback/session suites сохраняют проверки прокрутки,
сворачивания и session/revision semantics. `workspace.spec.ts` проверяет единую
строку заголовка сценариев с кнопкой без видимого текста, её доступное имя,
раскрытие панели клавиатурой, сохранение прокрутки списка и нижнего footer.

```bash
E2E_PREVIEW=1 npm --prefix frontend run test:e2e -- workbench-polish.spec.ts
```

[Скриншоты, результаты и ограничения проверки](verification/workbench-polish/).

## CI для pull request

`Build and verify` запускает один job `verify` на `ubuntu-24.04`. Новый коммит
отменяет устаревший прогон того же PR. Проверки выполняются без сокращения E2E:

- Python fixtures: Git-версии, formatter tooling и контракт релизных артефактов.
- Один `./mvnw -B -Djava.format=check verify`: форматирование, Git-версия,
  все Java algorithm/API/session/observability tests и исполняемый JAR.
- `npm ci --no-audit --no-fund`, TypeScript/Vite build и все Vitest tests.
- `playwright install --only-shell chromium`, без `apt` и полного headed-браузера.
- Dev E2E локальных split-сценариев; полный production E2E обеих коллекций
  на desktop/mobile (responsive, animation/playback, recovery); отдельный
  lifecycle-прогон со свежим backend и строгими квотами.

Удалены неиспользуемая контейнерная сборка и её health smoke job. Реальный JAR,
health и точная Git-версия по-прежнему проверяются Java integration tests и
`visualizer.spec.ts`. Отдельный Maven `validate` объединён с `verify`; `clean`
не нужен на свежем checkout CI. Ключ кэша IntelliJ зависит только от OS,
архитектуры и VERSION/BUILD: правки скрипта не вызывают повторную загрузку IDE.
Убраны негейтящие audit/funding-запросы `npm ci`;
Vitest/build и release-contract fixtures сохранены. Setup Java/Node и кэши
Maven/npm/IntelliJ оставлены: они выбирают нужные версии и ускоряют зависимости.

Браузерная загрузка имеет connection timeout 15 секунд и общий предел 3 минуты;
job ограничен 25 минутами, включая холодный кэш IntelliJ (~1.6 GB). Ошибки загрузки
или отсутствующие библиотеки завершают CI с ошибкой. При падении сохраняются
Surefire reports и отдельные HTML reports/traces/screenshots всех E2E-прогонов
на 7 дней. Сетевые ограничения перечислены в [RELIABILITY.md](RELIABILITY.md#зависимости-ci).
Ручной release workflow продолжает собирать JAR и frontend assets; его проверки
и публикация артефактов не изменены. Замеры GitHub Actions фиксируются в PR,
связанном с [Issue #72](https://github.com/Oleg520/java-collections-vizualizer/issues/72).

## HashMap visualization (#47 / #61)

Focused checks during visual iteration (from the repository root):

```bash
cd frontend
npx tsc --noEmit
npx vitest run src/features/hashmap/graph.test.ts src/features/hashmap/layout.test.ts src/features/hashmap/identity.test.ts src/features/hashmap/transitions.test.ts
npx playwright test hashmap-transitions.spec.ts
```

The new browser checks cover real split 6/7 and 2/7 occupancy/focus, all physical
links, both copies and rewind, intermediate SVG endpoints during forward/back
rotations, live reduced-motion and usable short/narrow viewports. The resize
preparations remain dev-only and are included in the development CI grep;
production runs the tree/navigation checks. Fixtures in
`features/hashmap/fixtures/transitions.json` are exact decoded Java research frames,
including right and removal rotations, not generated algorithm states.

[Visual review materials and limits of local validation](verification/hashmap-visualization/README.md).
Full final validation follows owner visual approval.

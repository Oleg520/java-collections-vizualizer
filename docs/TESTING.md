# Проверки и измерения

```bash
./mvnw verify                         # core + API + исполняемый JAR
npm --prefix frontend test            # Vitest: renderer layout
npm --prefix frontend run build       # strict TypeScript + Vite production
cd frontend
npx playwright install --with-deps chromium
npm run test:e2e                       # backend и Vite запускаются автоматически
E2E_PREVIEW=1 npm run test:e2e          # тот же E2E против production dist, порт 4173
```

Playwright также может использовать уже запущенные серверы на 8080/5173;
для CI требуется свободная пара 8080/4173 (production preview).
`--with-deps` устанавливает системные
библиотеки Chromium и на Linux может требовать административных прав.
Тесты работают с настоящим Java API, без подмены ответов.

Покрыты детерминированные случаи и 2400 псевдослучайных операций против
`java.util.HashMap` на Java 21. После каждой проверяются уникальность ключей/ID,
индексы, цепочки, parent/left/right/prev, чёрный корень, отсутствие красного
родителя у красного узла и одинаковая чёрная высота. Отдельно проверяются
переходы list/tree, split на две половины, видимость узлов в рабочих снимках,
стабильность ID, сохранность предыдущих снимков и результат trace.

GitHub Actions запускает `Build and verify` только при pull request.
Все восемь сценариев проверяются при initialCapacity 0/16/32/64. E2E также
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


Проверки сборки и доставки без доступа к серверу:

```bash
python3 -m unittest discover -s scripts/tests -v
python3 -m unittest discover -s deploy/tests -v
bash -n deploy/upload_backend.sh
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

## Session lifecycle regression (target 0.3.1)

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
test of separate application/management listeners. Operator access, metric
semantics and the local baseline/candidate comparison are documented in
[backend diagnostics](OBSERVABILITY.md). No public management route or production
load test is required.

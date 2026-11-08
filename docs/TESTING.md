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

GitHub Actions: Java/TS-сборка, unit/API-тесты, Chromium desktop/mobile E2E.
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

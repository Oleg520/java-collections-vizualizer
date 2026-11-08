# Java Collections Visualizer

Интерактивная лаборатория внутреннего устройства Java HashMap: вводите ключи,
выполняйте операции и наблюдайте вычисления, цепочки, resize и красно-чёрное дерево.

**[Открыть приложение](https://java-collections-visualizer.netlify.app)** ·
[HTTPS API / health](https://jcv-api.135-106-208-51.sslip.io/api/v1/health) ·
[Развёртывание и обслуживание](deploy/README.md)

Это **учебная инструментированная реализация, ориентированная на OpenJDK 21**.
Она исполняет алгоритм на Java и создаёт события непосредственно в ходе выполнения.
Приватные объекты `java.util.HashMap` в JVM не наблюдаются и через рефлексию не читаются.

![HashMap: красно-чёрное дерево](docs/hashmap-tree.png)

## Возможности

- Операции `put`, `get`, `remove`, `clear`, `reset`; String, Integer, null и учебные ключи с заданным hashCode.
- Коллизии, resize/split, treeification и балансировка красно-чёрного дерева; восемь готовых сценариев.
- Пошаговое воспроизведение, перемотка, скорость и история последних 12 операций.
- SVG-диаграмма с масштабированием и мобильным интерфейсом.
- Изолированные сессии с TTL, revision и ограничениями нагрузки.

## Технологии и архитектура

| Каталог | Назначение |
|---|---|
| `core/` | Java 21: инструментированный HashMap, события и неизменяемые снимки |
| `backend/` | Spring Boot: REST API, сессии, compact trace и ограничения запросов |
| `frontend/` | React, TypeScript, Vite, Tailwind CSS, Motion и SVG |
| `deploy/` | Конфигурации и проверяемые скрипты доставки backend |

Java исполняет алгоритм и формирует trace; React размещает узлы и воспроизводит
готовые снимки. Перемотка не вызывает API и не меняет состояние коллекции.

## Быстрый запуск

Нужны **JDK 21** (`java` в PATH либо `JAVA_HOME`), **Node.js 22.12+** и npm, **Git** и POSIX shell (`sh`). Сборка выполняется из Git checkout с тегами.
Maven 3.9.11 скачивается Maven Wrapper; отдельно устанавливать Maven не нужно.
Первый запуск сборки требует сети для загрузки зависимостей.

```bash
./mvnw clean verify
npm --prefix frontend ci
npm --prefix frontend run build
```

В первом терминале:

```bash
java -jar "$(sh scripts/backend-jar.sh)"
```

Во втором:

```bash
npm --prefix frontend run dev
```

Откройте **http://127.0.0.1:5173**. Vite проксирует `/api` на `http://127.0.0.1:8080`.
Проверка backend: `curl http://127.0.0.1:8080/api/v1/health`.
Windows: запускайте команды в Git Bash; при использовании `mvnw.cmd` также нужен `sh` в PATH. Альтернативно доступны
`make build`, `make backend`, `make frontend`, `make test`, `make e2e`.

Для разработки backend с Spring Boot:

```bash
./mvnw install -DskipTests
./mvnw -pl backend spring-boot:run
```

## Проверка

```bash
./mvnw verify
npm --prefix frontend run build
npm --prefix frontend test
```

[Полная проверка, E2E и измерение ресурсов](docs/TESTING.md).

## Docker и размещение

```bash
docker compose up --build
```

Docker требует обычный Git clone с каталогом `.git`; ZIP и Git worktree для
контейнерной сборки не подходят. Backend доступен на `http://localhost:8080`.
Frontend запускается отдельно. Для размещения frontend задайте `VITE_API_URL`
(HTTPS origin backend без `/api/v1`) до сборки и точный `ALLOWED_ORIGINS` у backend.
Пример локального окружения: [frontend/.env.example](frontend/.env.example).

Публичный frontend работает на Netlify, backend — отдельный Java-процесс.
[Описание доставки](deploy/README.md) · [Версии и релизы](docs/VERSIONING.md).

## Ограничения

Только HashMap: до 128 записей и 512 учебных ID на сессию, load factor 0.75.
Сессии хранятся в памяти одного backend и теряются при перезапуске.
Авторизации, БД и постоянной истории нет. Это учебная модель, а не отладчик JVM.

## Документация

- [Архитектура, сценарии и тонкости OpenJDK](docs/ARCHITECTURE.md)
- [Контракт API](docs/API.md) и [OpenAPI](docs/openapi.yml)
- [Ограничения API и доверие proxy](docs/API_SECURITY.md)
- [Проверки](docs/TESTING.md) и [результаты измерений](docs/verification/README.md)
- [Участие в разработке](CONTRIBUTING.md)
- [Мобильный интерфейс](docs/hashmap-mobile.png)

## Исходник и лицензия

Алгоритмы адаптированы из [OpenJDK 21 HashMap.java](https://github.com/openjdk/jdk21u/blob/3f3a1f534b7f2f5be6d7ded9d9832fa9394e763c/src/java.base/share/classes/java/util/HashMap.java).
Исходные copyright/license headers сохранены. Проект GPL-2.0; участки OpenJDK
сохраняют Classpath exception. Подробности, перечень изменений и checksum исходника:
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [LICENSE](LICENSE).

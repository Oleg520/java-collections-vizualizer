# Версии сборок и выпуск

## Правило версии

Единственный источник релизной версии — **один тег `X.Y.Z` на собираемом коммите**.
Числовые части не имеют ведущих нулей. Lightweight и annotated tags поддерживаются.
Тег на предке не делает текущий коммит релизом. Например:

| Git на HEAD | Maven / `/api/v1/health` | JAR | Интерфейс |
|---|---|---|---|
| `0.2.0` | `0.2.0` | `backend-0.2.0.jar` | `0.2.0` |
| `1.0.0` | `1.0.0` | `backend-1.0.0.jar` | `1.0.0` |
| Без релизного тега | `0.0.0-<полный SHA>-SNAPSHOT` | `backend-0.0.0-<полный SHA>-SNAPSHOT.jar` | `dev` |

Теги другой формы, включая исторический `v0.1.0`, не являются релизными для новой
схемы. Исторические тег и GitHub Release остаются без изменений. Два подходящих
релизных тега на одном коммите — ошибка сборки. Явно запрошенный в GitHub Actions
тег обязан быть единственным подходящим тегом на HEAD; неверный CI SHA также отклоняется.

[qoomon Maven Git Versioning Extension](https://github.com/qoomon/maven-git-versioning-extension/tree/v9.12.3)
меняет версии Maven reactor, parent и зависимости между модулями в памяти.
В `.mvn/maven-git-versioning-extension.xml` включён `considerTagsOnBranches`:
проверяются теги текущего коммита, даже если checkout остаётся на ветке.
`git describe` и предыдущий релиз не используются. Константа `0.0.0-SNAPSHOT`
в POM — техническая исходная версия, которую **не нужно менять для выпуска**.

`scripts/git-version.sh` проверяет неоднозначность и согласованность Maven с Git
в фазе `validate` корневого reactor. Запускайте сборку из корня проекта.
Vite вызывает тот же скрипт и встраивает результат в интерфейс
во время сборки. Fixture test проверяет совпадение строгих шаблонов Maven и скрипта.
Backend получает версию через Spring Boot `build-info` из своего JAR.
`frontend/package.json` и lock file содержат техническую версию приватного npm-пакета;
она не определяет версию приложения и не обновляется при релизах.

## Локально, CI и Docker

Нужны Git, POSIX shell, Java 21 и Node согласно `frontend/package.json`.
Используйте Git checkout с тегами, а не ZIP исходников:

```bash
git fetch origin 'refs/tags/*:refs/tags/*'
sh scripts/git-version.sh
./mvnw -B clean verify
./mvnw -q help:evaluate -Dexpression=project.version -DforceStdout
npm --prefix frontend ci
npm --prefix frontend run build
npm --prefix frontend test
python3 -m unittest discover -s scripts/tests -v
make backend
```

После смены коммита или тегов используйте `clean verify`. Общий селектор
`scripts/backend-jar.sh` требует ровно один `backend-*.jar` и отклоняет отсутствующие,
несколько устаревших JAR или симлинки. `.jar.original` не выбирается.

Actions checkout получает полную историю и теги; ручной deploy собирает
неизменяемый dispatch SHA. Docker также использует `.git` и те же правила:
запускайте `docker build -t collections-viz .` из обычного клона с каталогом `.git`.
Для Git worktree, где `.git` — ссылка-файл на внешний каталог, сначала сделайте
отдельный обычный клон. Локальные Git config, hooks и reflogs исключены из build context; объекты и refs
сохранены для Git-based versioning. История объектов всё ещё передаётся сборщику:
используйте доверенный builder и чистый клон. Финальный Docker image содержит только JRE и готовый JAR.

Если IDE не может импортировать multi-module проект с расширением, официальный
workaround qoomon — Maven importer VM option `-Dversioning.disable=true`.
Обычные сборки выполняйте с включённым расширением.

## Frontend deployment

Production frontend задаётся переменной `FRONTEND_URL`; API origin — `VITE_API_URL`.
Ручной workflow **Deploy frontend manually** работает только с `main`:
собирает точный dispatch SHA и требует единственный релизный тег на нём.
Checkout получает полную историю и теги; прежний тег на предке не подходит.
Публикуется проверенный артефакт `frontend/dist` через Wrangler в существующий
hosting-проект из `CLOUDFLARE_PAGES_PROJECT`, production branch `main`.

Автоматические production-сборки Pages из `main` владелец должен отключить,
сохранив GitHub integration и PR previews. Это **не считается выполненным** без
подтверждения владельца. Точные действия, secrets и GitHub environment описаны
в [инструкции доставки](../deploy/README.md#owner-setup-before-merge-not-performed-by-this-pr).
Preview-сборки используют `sh ../scripts/fetch-version-tags.sh` перед npm-командами:
скрипт получает annotated/lightweight tags даже в shallow checkout и проверяет
`CF_PAGES_COMMIT_SHA == HEAD`; ошибка fetch
останавливает сборку. Неотмеченный тегом preview показывает `dev`.
Добавление тега само по себе не запускает production deployment.

## Выпуск новой версии владельцем

1. После успешного CI и ревью PR выполнить merge в `main`. Сверить intended SHA
   с актуальным `origin/main` и использовать его для выпуска.
2. С отдельного разрешения владельца создать и опубликовать **один** тег `X.Y.Z`
   на этом SHA, например следующую свободную patch-версию, без `v`. Версии в POM, React и npm не менять.
3. Вручную запустить Actions **Deploy backend manually**, Branch **main**.
   Проверить dispatch SHA, имя JAR и SHA-256 в summary. Проверить
   `/api/v1/health`: `status=UP`, `java=21`, `version=X.Y.Z`.
4. Вручную запустить **Deploy frontend manually**, Branch **main**, пока dispatch
   SHA совпадает с тем же релизным SHA. Если `main` продвинулся, остановить выпуск:
   подготовить новый reviewed релиз на актуальном `main`, не перемещая старые теги.
   Проверить SHA и версию в summary, затем production deployment SHA в Pages.
   Workflow проверяет health backend и совпадение версии перед публикацией.
5. Проверить `X.Y.Z` в интерфейсе, health (`UP`, Java 21, `X.Y.Z`), CORS preflight
   с Cloudflare origin, создание сессии, операции коллекций и SPA reload.
   Проверить desktop/mobile и сохранение доступа с необходимого legacy frontend origin.
6. Только после этих проверок опубликовать GitHub Release, выбрав **тот же
   существующий тег** `X.Y.Z`.

Порядок: **PR → merge → tag → backend deploy → frontend deploy → проверки →
GitHub Release**. Публичный production `0.3.2` и его GitHub Release уже опубликованы;
не пересоздавайте их для этой миграции.

Оба компонента выпускаются с одного SHA и одной версией. При обновлении backend
старый frontend остаётся активен до ручной публикации нового: изменения API должны
сохранять совместимость в этом окне (включая уже открытые вкладки). Проверка версии
в workflow не доказывает совместимость контрактов. Несовместимое изменение требует
отдельного согласованного плана; не обходите проверку health. Перезапуск backend
сбрасывает сессии в памяти. Не запускайте одновременно последовательности разных
релизов; frontend concurrency не блокирует backend workflow и действия в Pages.

Production backend по-прежнему разрешён только из `main`, с тайм-аутом deploy job
10 минут. SSH restrictions, SHA-256, rollback и immutable файлы
`releases/<полный SHA>.jar` сохранены. Важно: добавление тега меняет байты JAR.
Если этот SHA уже развёрнут как dev/SNAPSHOT, helper отклонит новый hash для того же
SHA. Поэтому ставьте релизный тег **до первого backend deployment этого SHA**;
для уже доставленного SHA используйте новый reviewed коммит `main`, а не удаление
или перезапись серверного релиза.

Проверки тегов проводятся только во временных клонах/репозиториях без публикации
тегов. Разработка и открытие PR не включают merge, выпуск тега, GitHub Release,
production deploy или изменение VDS.

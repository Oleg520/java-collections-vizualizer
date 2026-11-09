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

## Release artifacts and delivery

[Build release artifacts](RELEASE_ARTIFACTS.md) is a manual, credential-free
main-only build. It requires the unique exact tag, runs the complete application
checks and publishes a versioned backend/frontend bundle with a manifest.
The API origin is a public build input; environment ownership and production
delivery remain outside application build logic.

Release order remains **PR → merge → tag → verified build → backend deploy →
frontend deploy → checks → GitHub Release**. The private coordinator consumes
the same bundle after validating successful CI, SHA/tag, hashes and environment
compatibility. Publish the Release only after delivery checks; never mutate
the existing 0.3.2 tag or Release.

Backend rollout must remain compatible with the preceding frontend and open
tabs. Version equality alone does not prove API compatibility. Restart loses
in-memory sessions. The same deployed source SHA cannot acquire different JAR
bytes: tag before the first deployment, retain immutable bytes and use a new
reviewed source commit for a new release.

The legacy direct-deployment workflows are removed by this PR when merged in the
approved handoff described in [deployment overview](../deploy/README.md).
Do not activate two production coordinators simultaneously. No push/PR/tag
automatically deploys production. Git-based frontend previews still fetch tags
with scripts/fetch-version-tags.sh and show dev without an exact release tag.
Keep their existing Root/Build/Output configuration.

All tag tests run in temporary repositories, without publishing tags. Local
development, PR creation and builds do not authorize merge, release creation,
production access or cutover.

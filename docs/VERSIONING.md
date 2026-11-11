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

## Локально и CI

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
java -jar "$(sh scripts/backend-jar.sh)"
```

Это проверка собранного JAR; для разработки через `spring-boot:run` используйте
`clean install -DskipTests` и `./mvnw -pl backend spring-boot:run`, как в
[README](../README.md#быстрый-запуск). После смены коммита или тегов повторите
`clean verify` (JAR) или `clean install` (запуск через Maven). Общий селектор
`scripts/backend-jar.sh` требует ровно один `backend-*.jar` и отклоняет отсутствующие,
несколько устаревших JAR или симлинки. `.jar.original` не выбирается.

Actions checkout получает полную историю и теги; release workflow собирает
неизменяемый dispatch SHA. Backend запускается как Java 21 JAR, frontend
публикуется отдельно как статические файлы.

Если IDE не может импортировать multi-module проект с расширением, официальный
workaround qoomon — Maven importer VM option `-Dversioning.disable=true`.
Обычные сборки выполняйте с включённым расширением.

## Релизные сборки и previews

[Build release artifacts](RELEASE_ARTIFACTS.md) — ручная сборка из `main` без
production-секретов. Workflow требует единственный точный тег на dispatch SHA,
выполняет проверки приложения и публикует backend/frontend с manifest.
API origin — публичный параметр сборки. Формат bundle и правила проверки
потребителем описаны в [контракте артефактов](RELEASE_ARTIFACTS.md).

Оба компонента собираются с одного SHA и одной версией. Backend должен сохранять
совместимость с предыдущим frontend и уже открытыми вкладками; равенство строк
версий само по себе не доказывает совместимость API. Перезапуск теряет сессии
в памяти. Ставьте тег до сборки релизных байтов и сохраняйте проверенный bundle:
пересборка того же SHA с другим набором тегов меняет версию и содержимое JAR.
Не перемещайте опубликованные теги и не заменяйте существующие артефакты.

Git-based frontend previews используют `scripts/fetch-version-tags.sh` перед
сборкой: скрипт получает annotated/lightweight tags даже в shallow checkout
и проверяет `CF_PAGES_COMMIT_SHA == HEAD`. Ошибка fetch останавливает сборку;
без точного релизного тега интерфейс показывает `dev`.
Настройки сборки preview — в [RELEASE_ARTIFACTS.md](RELEASE_ARTIFACTS.md#static-hosting-and-previews).

Тесты тегов выполняются во временных репозиториях без публикации тегов.
PR и push не запускают release workflow или production delivery.

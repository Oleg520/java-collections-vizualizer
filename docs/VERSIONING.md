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

## Netlify

`netlify.toml` перед `npm ci && npm run build` запускает
`sh ../scripts/fetch-version-tags.sh`. Скрипт явно получает все tag refs из URL `origin` (GitHub SSH URL преобразуется
в публичный HTTPS без изменения remote),
в том числе annotated tags при shallow checkout, и проверяет `COMMIT_REF == HEAD`.
Ошибка получения тегов останавливает сборку: релиз не должен незаметно становиться `dev`.
Версия определяется по фактическому HEAD, а не по имени ветки или npm metadata.

Сборка Netlify после merge, выполненная **до создания тега**, показывает `dev`.
Добавление тега не обновляет уже опубликованные JS-файлы и не должно запускать
production deployment. После создания тега владелец явно запускает **Deploys →
Trigger deploy → Clear cache and deploy site** для `main`, пока HEAD `main` совпадает
с релизным SHA. Проверяйте SHA в логе сборки и отображаемую версию в интерфейсе.
[Netlify при повторной сборке использует последний коммит ветки](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/#retry-deploy-from-latest-branch-commit),
даже если выбран старый deploy. Если `main` уже продвинулся, обычный retry не
пересоберёт старый релиз; согласуйте новый релиз на актуальном reviewed `main`.
Автоматические frontend-сборки при push/merge в `main` сохраняются как раньше.

## Выпуск новой версии владельцем

1. Дождаться успешного CI и ревью PR, затем выполнить merge в `main`.
   `Build and verify` запускается только для pull request: push в `main` и публикация тегов
   не запускают повторную проверку. Сверить intended SHA с актуальным `origin/main`.
   До завершения выпуска не продвигать `main`.
2. С отдельного разрешения владельца создать и опубликовать **один** тег `X.Y.Z`
   на этом SHA, например `0.2.0`, без `v`. Версии в POM, React и npm не менять.
3. Вручную запустить Actions **Deploy backend manually**, Branch **main**.
   Проверить dispatch SHA, имя JAR и SHA-256 в summary. Проверить
   `/api/v1/health`: `status=UP`, `java=21`, `version=X.Y.Z`.
4. Явно пересобрать Netlify для того же `main` SHA, как описано выше; проверить `X.Y.Z`
   в интерфейсе и работу API. Сам тег production deployment не запускает.
5. После проверки опубликовать GitHub Release, выбрав **тот же существующий тег** `X.Y.Z`.

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

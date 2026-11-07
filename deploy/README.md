# Production: Netlify + Selectel

Первый публичный выпуск: **7 ноября 2026 года**.

- Приложение: https://java-collections-visualizer.netlify.app
- API: https://jcv-api.135-106-208-51.sslip.io
- Health: https://jcv-api.135-106-208-51.sslip.io/api/v1/health

HTTPS API обслуживает существующий Caddy;
сертификат Let's Encrypt обновляется автоматически.
Исходная версия Java: `830b799`; SHA-256 установленного JAR:
`cfd6979ba5aba77b96a0d28ac867b8cfbaddad480db27129d0d1df3800e0d2bc`.

## Backend

- Java 21 runtime из Ubuntu; JAR собирается **вне VDS**.
- Systemd: `java-collections-visualizer.service`, пользователь `jcv`.
- HTTP: только `127.0.0.1:18082`, порт не открывается в firewall.
- JAR: `/opt/java-collections-visualizer/releases/<revision>.jar`;
  `current.jar` — ссылка на активный выпуск.
- Окружение: `/etc/java-collections-visualizer.env`, root, mode 0600.
- Heap: 256 MiB; MemoryHigh: 384 MiB; MemoryMax: 512 MiB; swap: 64 MiB.
- CPUQuota: 100% (одно ядро), CPUWeight: 20, TasksMax: 96.
- HTTP_THREADS=4, MAX_SESSIONS=32, SESSION_TTL_SECONDS=1800.
- Сервис включён в автозапуск. Сессии теряются при его перезапуске.

Файлы в этой папке соответствуют установленному unit и отдельному Caddy-маршруту.
`backend.env.example` содержит шаблон окружения без секретов.

В `/etc/caddy/Caddyfile` добавлена только строка:

```caddyfile
import /etc/caddy/java-collections-visualizer.caddy
```

Исходная конфигурация и адаптированные JSON до/после сохранены на VDS в
`/var/backups/java-collections-visualizer/first-deploy-830b799/`.
Перед graceful reload проверено равенство старых маршрутов и настроек.
Friendly Loan, его dev-окружение, PostgreSQL и Caddy сохранили исходные PID.

### Обновление JAR

Из чистого checkout нужного коммита `main`, локально (Java 21):

```bash
./mvnw -B verify
git rev-parse --short HEAD
sha256sum backend/target/backend-0.1.0.jar
scp backend/target/backend-0.1.0.jar fl-prod-admin:backend-upload.jar
```

На VDS укажите фактическую ревизию, проверьте SHA-256 и сохраните прежнюю ссылку:

```bash
sha256sum ~/backend-upload.jar
sudo readlink /opt/java-collections-visualizer/current.jar
# Заменить REVISION фактическим идентификатором собранного коммита:
sudo install -o root -g jcv -m 0640 ~/backend-upload.jar \
  /opt/java-collections-visualizer/releases/REVISION.jar
sudo ln -s releases/REVISION.jar /opt/java-collections-visualizer/next.jar
sudo mv -Tf /opt/java-collections-visualizer/next.jar \
  /opt/java-collections-visualizer/current.jar
sudo systemctl restart java-collections-visualizer
curl --fail http://127.0.0.1:18082/api/v1/health
curl --fail https://jcv-api.135-106-208-51.sslip.io/api/v1/health
```

Для отката повторите переключение ссылки на прежний JAR и перезапустите только
`java-collections-visualizer`. Caddy и Friendly Loan для обновления JAR не перезапускаются.
Не удаляйте предыдущий JAR до успешной проверки нового выпуска.

### Диагностика

```bash
sudo systemctl status java-collections-visualizer --no-pager
sudo journalctl -u java-collections-visualizer -n 100 --no-pager
sudo systemctl show java-collections-visualizer \
  -p MemoryCurrent -p MemoryPeak -p NRestarts -p TasksCurrent
ss -ltn | grep 18082
```

Для изменения нового HTTPS-маршрута редактируется только
`/etc/caddy/java-collections-visualizer.caddy`. Затем:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

## Ручной workflow доставки backend

Workflow `.github/workflows/deploy-backend.yml` запускается **только вручную**.
Push, PR и merge не вызывают production deployment. Workflow должен сначала попасть
в `main` после ревью и успешного CI. Первая production-проверка остаётся действием
владельца: в рамках разработки workflow сервер и его сервисы не изменялись.

### Как это работает

1. GitHub фиксирует SHA `main` в момент Run workflow; другая ветка или тег отклоняются.
   Оба job checkout используют этот неизменяемый SHA, даже если `main` позже продвинется.
2. Отдельный job без SSH-секретов собирает JAR на hosted runner с Java 21, выполняет
   `mvn verify` и локальные deployment fixtures. В summary записываются SHA и SHA-256
   JAR; этот же файл сохраняется в Actions artifact на 7 дней.
3. После проверок job с environment `backend-production` скачивает **тот же artifact**,
   проверяет hash и передаёт его по SSH/SCP выделенному `jcv-deploy`.
4. Root-owned helper принимает только полный SHA и SHA-256. Он проверяет обычный
   файл, владельца, размер до 96 MiB и hash скопированных байтов. Release JAR никогда
   не перезаписывается; ссылка `current.jar` переключается атомарно.
5. Перезапускается только `java-collections-visualizer.service`. Проверяется JSON
   `status=UP`, `java=21` по localhost и публичному HTTPS. При сбое возвращается старая
   ссылка, сбрасывается start-limit только этого сервиса, затем он перезапускается
   и обе проверки выполняются повторно. Workflow при этом завершается с ошибкой.

GitHub concurrency и серверный file lock предотвращают параллельное переключение.
Timestamp архива берётся из времени коммита для воспроизводимых повторных сборок.
Повтор того же SHA с тем же hash допустим; если toolchain/dependencies дали другой
hash, helper откажет, сохранив прежний JAR. Не удаляйте release ради обхода проверки.
Смена ссылки сопровождается коротким перезапуском; in-memory-сессии теряются.
SIGTERM/SIGHUP/SIGINT вызывают откат после начала переключения; при SIGKILL, потере
питания или неуспешном откате требуется ручная проверка владельцем. Диагностика
показывает только состояние фиксированного systemd-сервиса, не request payload/секреты.

### Однократная настройка владельцем

Следующие действия **не выполнены агентом**. Они выполняются владельцем через
доверенный административный доступ после проверки helper и merge PR.
Новый пользователь не должен входить в группы `sudo`, `jcv` или пользователей
Friendly Loan; его права — запись в incoming и единственный sudo entry point.

1. На доверенной локальной машине создайте отдельный ключ для Actions:

   ```bash
   ssh-keygen -t ed25519 -f jcv-deploy-actions -C jcv-backend-actions -N ''
   ```

   Файл `.pub` предназначен серверу. Приватный файл передаётся только в GitHub
   Environment Secret; не добавляйте его в Git, PR, чаты или логи.

2. На VDS из проверенного checkout установите пользователя и helper:

   ```bash
   sudo useradd --system --no-create-home --home-dir /var/lib/jcv-deploy \
     --shell /bin/bash jcv-deploy
   sudo install -d -o root -g root -m 0755 /var/lib/jcv-deploy
   sudo install -d -o jcv-deploy -g jcv-deploy -m 0700 /var/lib/jcv-deploy/incoming
   sudo install -d -o root -g root -m 0755 /var/lib/jcv-deploy/.ssh
   sudo install -o root -g root -m 0755 deploy/backend_deploy.py /usr/local/sbin/jcv-deploy
   ```

   Если пользователь уже существует, сначала проверьте его назначение и права.
   В root-owned `/var/lib/jcv-deploy/.ssh/authorized_keys` (mode 0644) поместите
   **одну** строку: `restrict ` и далее полную строку из `jcv-deploy-actions.pub`.
   Это оставляет SSH/SFTP-команды, запрещая forwarding и PTY; deploy user не может
   переписывать собственные authorized_keys. Учитывайте существующие SSH AllowUsers/
   AllowGroups: владелец добавляет нового пользователя в действующее разрешение,
   сохраняя прежние аккаунты, и проверяет `sshd -t` перед reload SSH при необходимости.

   `current.jar` уже должен указывать на рабочий JAR внутри `releases`. Каталоги
   `/opt/java-collections-visualizer` и `releases` остаются `root:jcv`, mode 0750,
   JAR — `root:jcv`, mode 0640. Incoming parent — root-owned, без записи для deploy user.
   Helper не устанавливает JRE, unit, окружение, Caddy или другие приложения.

3. Через `sudo visudo -f /etc/sudoers.d/jcv-deploy` добавьте только:

   ```sudoers
   jcv-deploy ALL=(root) NOPASSWD: /usr/local/sbin/jcv-deploy *
   ```

   Затем `sudo chmod 0440 /etc/sudoers.d/jcv-deploy` и
   `sudo visudo -cf /etc/sudoers.d/jcv-deploy`. Helper сам строго валидирует два
   аргумента; не выдавайте sudo для shell, Python interpreter, systemctl или install.
   Файл helper и родительские каталоги должны быть доступны на запись только root.
   Его будущие обновления также устанавливает администратор после ревью.

4. Получите host public key **через доверенную Selectel console**, например из
   `/etc/ssh/ssh_host_ed25519_key.pub`, и проверьте его fingerprint командой
   `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`. Подготовьте known_hosts запись
   для `135.106.208.51` (порт 22) с этим проверенным публичным ключом. Не доверяйте
   непроверенному результату `ssh-keyscan`; не отключайте StrictHostKeyChecking.

5. GitHub → Settings → Environments → создайте **`backend-production`**.
   **До добавления секретов** настройте Deployment branches and tags → Selected
   branches and tags → разрешить только **ветку `main`**, без тегов и PR-веток.
   Это обязательная граница: проверку внутри workflow можно изменить в чужой ветке,
   но environment не должен выдавать ей production secrets. Настройка не требует
   платной branch protection; для этого публичного репозитория environments доступны.
   При возможности добавьте required reviewer для дополнительного подтверждения.

   В secrets этого environment (не общих repository secrets) создайте:

   | Secret | Содержимое |
   |---|---|
   | `JCV_DEPLOY_SSH_KEY` | Приватный ключ отдельного `jcv-deploy`, целиком |
   | `JCV_DEPLOY_KNOWN_HOSTS` | Проверенная known_hosts запись для VDS |

### Запуск и результат

1. Убедитесь, что нужные изменения уже reviewed/merged в `main` и CI успешен.
2. GitHub → Actions → **Deploy backend manually** → **Run workflow** → Branch `main`.
   Нажатие Run workflow — явное разрешение production deployment; без него запусков нет.
3. При настроенном reviewer одобрите environment job. Откройте summary: там SHA,
   hash и результат health checks; исходный JAR доступен в artifacts.
4. При failed run смотрите причину и сообщение об откате. При
   `Owner intervention required` используйте диагностические команды и ручную
   процедуру отката выше. Не перезапускайте Friendly Loan, PostgreSQL или Caddy.

Локальная проверка без SSH и сервисов: `python3 -m unittest discover -s deploy/tests -v`
и `bash -n deploy/upload_backend.sh`. Fixture tests создают временные каталоги,
подменяют systemctl/HTTP/SSH и проверяют отказ, откат и очистку ключевых файлов.
Реальный production smoke test после настройки ещё предстоит владельцу.

Официальные инструкции: [ручной запуск workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow),
[environment secrets и ограничения веток](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).

## Frontend

Один GitHub-репозиторий: `Oleg520/java-collections-vizualizer`, ветка `main`.
Netlify project ID: `f9043ee7-d2f9-4e90-bbd4-d90bc69fd6a6`.
К репозиторию добавлены отдельный read-only deploy key и webhook события push;
Netlify автоматически собирает frontend из `main`. Java backend этим webhook
не обновляется. Для ручного обновления backend используйте процедуру выше.

Корневой `netlify.toml` задаёт base `frontend`, command `npm ci && npm run build`,
publish `dist` относительно base. Production environment содержит:

```text
VITE_API_URL=https://jcv-api.135-106-208-51.sslip.io
```

Это origin **без `/api/v1`**; Vite встраивает его при сборке. Изменение адреса API
требует новой сборки frontend. Для ручной сборки вне Netlify:

```bash
VITE_API_URL=https://jcv-api.135-106-208-51.sslip.io npm --prefix frontend run build
```

На сервере в `/etc/java-collections-visualizer.env` установлено:

```text
ALLOWED_ORIGINS=https://java-collections-visualizer.netlify.app
```

При смене домена указывайте точный HTTPS origin без завершающего `/`, затем
перезапустите только новый Java-сервис. Проверяйте preflight OPTIONS и реальные команды из браузера.
Preview-домены не разрешаются автоматически. API-токены Netlify хранятся в
локальном конфиге CLI, а не в Git; `.netlify/` исключён через `.gitignore`.

## Проверки первого публичного выпуска

- `./mvnw verify`: 18 тестов, успешная сборка JAR.
- Публичный HTTPS: валидный сертификат, TLS 1.3, health UP / Java 21.
- Через HTTPS: put/get/update/remove, null, clear/reset и все 8 готовых сценариев.
- Публичный Netlify UI проверен Playwright в Chromium desktop 1440×1080 и Pixel 7:
  put/get/remove, перемотка истории и все 8 сценариев; нет ошибок JS/CORS и
  горизонтального переполнения страницы.
- Preflight OPTIONS разрешает точный Netlify origin и отклоняет посторонний origin.
- GitHub Actions на коммите `465b243`: сборки, Java/Vitest и 18 E2E — success.
- Проверены localhost binding, автозапуск и фактические ограничения systemd.
- Основной и dev-сайт Friendly Loan после изменений возвращают HTTP 200.
- Docker не устанавливался. Исходники приложения и Issues #2–#5 не изменялись.

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

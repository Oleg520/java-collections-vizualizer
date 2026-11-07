# Подключение Google Search Console

Основной адрес сайта: **https://java-collections-visualizer.netlify.app/**.
Подготовка помогает Google обнаружить страницу; решение об индексации и сроках
принимает Google. Подтверждение владения и запрос индексации выполняет владелец
в своём Google-аккаунте.

## Что подготовлено в репозитории

- Title, description, `lang="ru"` и canonical находятся в исходном HTML, доступны
  без выполнения JavaScript. Canonical указывает на основной адрес с `/` в конце.
- `frontend/public/robots.txt` разрешает обход и содержит абсолютный адрес sitemap.
- `frontend/public/sitemap.xml` содержит только существующую главную страницу.
  Учебные сценарии не являются отдельными URL.
- Vite копирует файлы из `frontend/public/` в корень `frontend/dist/` без обработки.
  Существующий SPA rewrite в `netlify.toml` не имеет `force = true`, поэтому
  [существующие статические файлы имеют приоритет](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/#shadowing).

Эти изменения появятся на production после ревью, merge и штатной сборки Netlify
из `main`. Текущий PR не подтверждает владение сайтом и не отправляет его в Google.

## Действия владельца: подтверждение

1. Войдите в [Google Search Console](https://search.google.com/search-console/)
   своим Google-аккаунтом и выберите добавление ресурса.
2. Выберите **«Ресурс с префиксом в URL» / URL-prefix**, укажите точно
   `https://java-collections-visualizer.netlify.app/`. Не выбирайте Domain property:
   HTML-файл поддерживается для URL-prefix, доступ к DNS `netlify.app` не требуется.
3. Выберите способ **«HTML-файл»** и скачайте предложенный Google файл.
   [Имя и содержимое нужно сохранить без изменений](https://support.google.com/webmasters/answer/9008080?hl=ru).
4. Передайте оригинальный файл разработчику либо добавьте его напрямую в
   `frontend/public/` через отдельную ветку и PR. Нужен файл из вашего аккаунта;
   выдуманных токенов, пустых заглушек и verification meta tag в проекте нет.
5. После ревью и штатной публикации откройте файл по адресу, указанному Google:
   корень production-сайта + точное имя скачанного файла. Проверьте в приватном
   окне, что получен **HTTP 200 без редиректа и исходное содержимое файла Google**.
   Одного статуса 200 недостаточно: при отсутствии файла SPA fallback тоже может
   вернуть 200, но с HTML приложения.
6. Вернитесь в Search Console и нажмите **«Подтвердить»**. Не удаляйте файл после
   подтверждения: Google периодически перепроверяет его наличие.

До получения оригинального файла шаги 4–6 остаются за владельцем и разработчиком.
Пароль Google и доступ к аккаунту разработчику не нужны.

## Действия владельца: индексация и статус

1. В разделе **Sitemaps / «Файлы Sitemap»** добавьте
   `https://java-collections-visualizer.netlify.app/sitemap.xml` и проверьте результат
   обработки.
2. В **«Проверке URL» / URL Inspection** введите
   `https://java-collections-visualizer.netlify.app/`, выполните проверку опубликованной
   страницы. Откройте результат рендеринга: должен отображаться интерфейс HashMap.
   [Инструмент показывает доступность, выбранный Google canonical и статус индексации](https://support.google.com/webmasters/answer/9012289?hl=ru).
3. Если страница доступна для индексирования, нажмите **«Запросить индексирование»**.
   [Повторный запрос не ускоряет обработку](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl?hl=ru).
4. Проверяйте статус через «Проверку URL» и отчёт **«Индексирование → Страницы»**.
   Подтверждение владения или успешная обработка sitemap сами по себе не означают,
   что страница уже попала в индекс.

## Проверки разработчика

```bash
npm --prefix frontend run build
```

Проверьте наличие `robots.txt`, `sitemap.xml`, canonical в `frontend/dist/`.
Если получен verification-файл, сравните его с копией в dist, включая имя и содержимое.
После штатного обновления production:

```bash
curl -i https://java-collections-visualizer.netlify.app/
curl -i https://java-collections-visualizer.netlify.app/robots.txt
curl -i https://java-collections-visualizer.netlify.app/sitemap.xml
```

Ожидаются HTTP 200, `text/plain` для robots и XML для sitemap, без подмены HTML
приложения. На главной не должно быть `noindex` в meta robots или `X-Robots-Tag`.
Для verification-файла используйте его фактический URL из Search Console.

Приложение остаётся SPA: [Google выполняет JavaScript при рендеринге](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics),
поэтому окончательную доступность содержимого проверяйте в URL Inspection.
SSR, аналитика и доступ к Google-аккаунту не требуются для этой подготовки.
При смене production-домена согласованно обновите canonical, robots, sitemap
и ресурс Search Console. Preview URL и адрес Java API не включаются в sitemap.

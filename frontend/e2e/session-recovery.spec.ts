import { test, expectServerSize, expect } from "./support";

test("a lost committed response recovers state without retrying rapid commands", async ({
  page,
  request,
}) => {
  const created = page.waitForResponse(
    (response) =>
      /\/sessions(?:\?.*)?$/.test(response.url()) &&
      response.request().method() === "POST",
  );
  await page.goto("/");
  const session = await (await created).json();
  await expect(
    page.getByRole("button", { name: "Выполнить put" }),
  ).toBeEnabled();
  let writes = 0;
  page.on("request", (response) => {
    if (response.method() === "POST" && response.url().includes("/commands"))
      writes++;
  });
  await page.route(
    /\/commands\?encoding=compact(?:&.*)?$/,
    async (route) => {
      // Java really commits. Only delivery of its response to the browser is interrupted.
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      await response.dispose();
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page.locator(".command-form").evaluate((element) => {
    const form = element as HTMLFormElement;
    // Both submits reach the handler before React can disable the button.
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.getByRole("alert")).toContainText(
    "Нет ответа от Java-сервиса",
  );
  await expectServerSize(page, 1);
  await expect(
    page.getByRole("button", { name: "Выполнить put" }),
  ).toBeEnabled();
  expect(writes).toBe(1);
  await expect(page.getByLabel("История операций")).toHaveValue("-1");
  await expect(page.getByTestId("step-number")).toHaveText("0");
  const response = await request.get(
    `/api/v1/sessions/${session.id}?snapshotVersion=2`,
  );
  const committed = await response.json();
  expect(committed.revision).toBe(1);
  expect(committed.state.size).toBe(1);
  await response.dispose();

  // Recovery has released the lock and refreshed revision for an explicit next command.
  await page.getByLabel("Операция", { exact: true }).selectOption("GET");
  await page.getByRole("button", { name: "Выполнить get" }).click();
  await expect(page.locator(".primary-button")).toBeEnabled();
  await page.getByRole("button", { name: "В конец", exact: true }).click();
  await expect(page.getByTestId("operation-result")).toHaveText('"Hello"');
  expect(writes).toBe(2);
  await expect(
    page.getByLabel("История операций").locator("option"),
  ).toHaveCount(2);
});

for (const collection of ["HASH_MAP", "ARRAY_LIST"] as const) {
  test(`${collection}: failed reconciliation blocks writes, explicit recovery preserves state and history`, async ({
    page,
  }) => {
    let creates = 0,
      writes = 0,
      resets = 0;
    page.on("request", (r) => {
      if (r.method() !== "POST") return;
      if (/\/sessions(?:\?.*)?$/.test(r.url())) creates++;
      if (r.url().includes("/commands?")) writes++;
      if (/\/reset(?:\?.*)?$/.test(r.url())) resets++;
    });
    await page.goto("/");
    await expect(page.locator(".primary-button")).toBeEnabled();
    if (collection === "ARRAY_LIST") {
      await page
        .getByLabel("Коллекция", { exact: true })
        .selectOption(collection);
      await expect(
        page.getByRole("button", { name: "Выполнить add(E)", exact: true }),
      ).toBeEnabled();
    }
    await page.locator(".primary-button").click();
    await expectServerSize(page, 1);
    await expect(page.locator(".primary-button")).toBeEnabled();
    await page.route(
      /\/sessions\/[^/?]+(?:\?.*)?$/,
      (route) => route.abort("failed"),
      {
        times: 1,
      },
    );
    await page.route(
      /\/commands\?encoding=compact(?:&.*)?$/,
      async (route) => {
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        await response.dispose();
        await route.abort("failed");
      },
      { times: 1 },
    );
    if (collection === "HASH_MAP")
      await page.getByLabel("Ключ", { exact: true }).fill("second");
    await page.locator(".primary-button").click();
    await expect(page.getByRole("alert")).toContainText(
      "Актуальное состояние пока не получено",
    );
    await expect(page.locator(".primary-button")).toBeDisabled();
    await expect(page.locator(".loading-banner")).toHaveCount(0);
    await expect(page.locator(".primary-button .spin")).toHaveCount(0);
    await expect(page.getByTestId("metric-size")).toHaveText("1");
    const resetsBefore = resets;
    await page
      .getByRole("button", { name: "Обновить состояние", exact: true })
      .click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.locator(".primary-button")).toBeEnabled();
    await expect(page.getByTestId("metric-size")).toHaveText("2");
    await expect(
      page.getByLabel("История операций").locator("option"),
    ).toHaveCount(2);
    expect(writes).toBe(2);
    expect(resets).toBe(resetsBefore);
    expect(creates).toBe(1);
    // The next explicit mutation uses the reconciled revision.
    await page.locator(".primary-button").click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.locator(".primary-button")).toBeEnabled();
    expect(writes).toBe(3);
  });

  test(`${collection}: 409 refreshes the diagram even with previous playback selected`, async ({
    page,
    request,
  }) => {
    const created = page.waitForResponse(
      (r) =>
        /\/sessions(?:\?.*)?$/.test(r.url()) && r.request().method() === "POST",
    );
    await page.goto("/");
    const session = await (await created).json();
    await expect(page.locator(".primary-button")).toBeEnabled();
    if (collection === "ARRAY_LIST") {
      await page
        .getByLabel("Коллекция", { exact: true })
        .selectOption(collection);
      await expect(
        page.getByRole("button", { name: "Выполнить add(E)", exact: true }),
      ).toBeEnabled();
    }
    await page.locator(".primary-button").click();
    await expectServerSize(page, 1);
    await expect(page.locator(".primary-button")).toBeEnabled();
    const current = await (
      await request.get(`/api/v1/sessions/${session.id}?snapshotVersion=2`)
    ).json();
    const external = await request.post(
      `/api/v1/sessions/${session.id}/commands?encoding=compact&snapshotVersion=2`,
      {
        data: {
          expectedRevision: current.revision,
          operation: { type: "CLEAR", key: null, value: null },
        },
      },
    );
    expect(external.ok()).toBe(true);
    await page.locator(".primary-button").click();
    await expect(page.getByRole("alert")).toContainText("Состояние изменилось");
    await expect(page.getByTestId("metric-size")).toHaveText("0");
    await expectServerSize(page, 0);
    await page
      .getByRole("button", { name: "Обновить состояние", exact: true })
      .click();
    await expect(page.getByTestId("metric-size")).toHaveText("0");
    await page.locator(".primary-button").click();
    await expectServerSize(page, 1);
  });

  for (const status of [429, 503]) {
    test(`${collection}: ${status} respects Retry-After and never retries the command`, async ({
      page,
    }) => {
      let writes = 0,
        creates = 0;
      page.on("request", (r) => {
        if (r.method() === "POST" && r.url().includes("/commands?")) writes++;
        if (r.method() === "POST" && /\/sessions(?:\?.*)?$/.test(r.url()))
          creates++;
      });
      await page.goto("/");
      await expect(page.locator(".primary-button")).toBeEnabled();
      if (collection === "ARRAY_LIST") {
        await page
          .getByLabel("Коллекция", { exact: true })
          .selectOption(collection);
        await expect(
          page.getByRole("button", { name: "Выполнить add(E)", exact: true }),
        ).toBeEnabled();
      }
      await page.route(
        /\/commands\?encoding=compact(?:&.*)?$/,
        (route) =>
          route.fulfill({
            status,
            headers: { "Retry-After": "2" },
            contentType: "text/html",
            body: "busy",
          }),
        { times: 1 },
      );
      await page.locator(".primary-button").click();
      await expect(page.getByRole("alert")).toContainText(
        "Повторный запрос через",
      );
      await expect(
        page.getByRole("button", { name: "Обновить состояние", exact: true }),
      ).toBeDisabled();
      await expect(page.locator(".primary-button")).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Обновить состояние", exact: true }),
      ).toBeEnabled();
      expect(writes).toBe(1);
      await expectServerSize(page, 0);
      await page
        .getByRole("button", { name: "Обновить состояние", exact: true })
        .click();
      await expect(page.locator(".primary-button")).toBeEnabled();
      expect(creates).toBe(1);
      expect(writes).toBe(1);
      await page.locator(".primary-button").click();
      await expectServerSize(page, 1);
      expect(writes).toBe(2);
    });
  }
}

test("expired session or backend restart keeps the last snapshot and creates only on explicit recovery", async ({
  page,
}) => {
  let creates = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/sessions(?:\?.*)?$/.test(r.url()))
      creates++;
  });
  await page.goto("/");
  await expect(page.locator(".primary-button")).toBeEnabled();
  await page.locator(".primary-button").click();
  await expectServerSize(page, 1);
  await expect(page.locator(".primary-button")).toBeEnabled();
  await page.route(
    /\/commands\?encoding=compact(?:&.*)?$/,
    (route) =>
      route.fulfill({
        status: 404,
        json: { code: "SESSION_NOT_FOUND", message: "expired" },
      }),
    { times: 1 },
  );
  await page.locator(".primary-button").click();
  await expect(page.getByRole("alert")).toContainText(
    "Прежнее состояние сервера недоступно",
  );
  await expect(page.getByTestId("metric-size")).toHaveText("1");
  await expect(page.locator(".primary-button")).toBeDisabled();
  expect(creates).toBe(1);
  await page.getByRole("button", { name: "Новая сессия", exact: true }).click();
  await expect(page.locator(".primary-button")).toBeEnabled();
  await expect(page.getByTestId("metric-size")).toHaveText("0");
  expect(creates).toBe(2);
});

test("initial backend failure stops the spinner and permits an explicit connection", async ({
  page,
}) => {
  await page.route(
    /\/sessions(?:\?.*)?$/,
    (route) => route.fulfill({ status: 503, body: "unavailable" }),
    { times: 1 },
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("временно недоступен");
  await expect(
    page.getByRole("heading", { name: "Нет соединения с Java-движком" }),
  ).toBeVisible();
  await expect(page.locator(".connecting .spin")).toHaveCount(0);
  await page.getByRole("button", { name: "Новая сессия", exact: true }).click();
  await expect(page.locator(".primary-button")).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a committed command whose response never arrives times out and reconciles without replay", async ({
  page,
}) => {
  test.setTimeout(45000);
  let writes = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/commands?")) writes++;
  });
  await page.goto("/");
  await expect(page.locator(".primary-button")).toBeEnabled();
  await page.route(
    /\/commands\?encoding=compact(?:&.*)?$/,
    async (route) => {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      await response.dispose();
      // Neither fulfill nor abort: exercise the browser's real request deadline.
    },
    { times: 1 },
  );
  await page.locator(".primary-button").click();
  await expect(page.getByRole("alert")).toContainText(
    "Нет ответа от Java-сервиса",
    { timeout: 20000 },
  );
  await expect(page.locator(".primary-button")).toBeEnabled();
  await expect(page.getByTestId("metric-size")).toHaveText("1");
  await expect(page.locator(".loading-banner")).toHaveCount(0);
  expect(writes).toBe(1);
  await page.locator(".primary-button").click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".primary-button")).toBeEnabled();
  expect(writes).toBe(2);
});

test("a switch waiting for scenarios cannot create another slot after a lost creation", async ({
  page,
}) => {
  let creates = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/sessions(?:\?.*)?$/.test(r.url()))
      creates++;
  });
  let releaseCreate!: () => void,
    createArrived!: () => void,
    releaseCatalog!: () => void;
  const createGate = new Promise<void>((r) => (releaseCreate = r));
  const arrived = new Promise<void>((r) => (createArrived = r));
  const catalogGate = new Promise<void>((r) => (releaseCatalog = r));
  await page.route(
    /\/sessions(?:\?.*)?$/,
    async (route) => {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      createArrived();
      await createGate;
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page.route(/\/scenarios\?collection=ARRAY_LIST$/, async (route) => {
    const response = await route.fetch();
    await catalogGate;
    await route.fulfill({ response });
  });
  await page.goto("/");
  await arrived;
  await page
    .getByLabel("Коллекция", { exact: true })
    .selectOption("ARRAY_LIST");
  const failed = page.waitForEvent("requestfailed", {
    predicate: (r) => /\/sessions(?:\?.*)?$/.test(r.url()),
  });
  releaseCreate();
  await failed;
  releaseCatalog();
  await expect(page.getByRole("alert")).toContainText("явным действием");
  expect(creates).toBe(1);
  await page.getByRole("button", { name: "Новая сессия", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Выполнить add(E)", exact: true }),
  ).toBeEnabled();
  expect(creates).toBe(2);
});

test("zero or elapsed Retry-After does not leave recovery permanently disabled", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".primary-button")).toBeEnabled();
  for (const retryAfter of ["0", "Tue, 10 Nov 2020 10:00:00 GMT"]) {
    await page.route(
      /\/commands\?encoding=compact(?:&.*)?$/,
      (route) =>
        route.fulfill({
          status: 429,
          headers: { "Retry-After": retryAfter },
          body: "busy",
        }),
      { times: 1 },
    );
    await page.locator(".primary-button").click();
    await expect(page.getByRole("alert")).toContainText(
      "Слишком много запросов",
    );
    await expect(
      page.getByRole("button", { name: "Обновить состояние", exact: true }),
    ).toBeEnabled();
    await expect(page.locator(".primary-button")).toBeEnabled();
    await expect(page.locator(".primary-button .spin")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Обновить состояние", exact: true })
      .click();
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  await page.locator(".primary-button").click();
  await expectServerSize(page, 1);
});

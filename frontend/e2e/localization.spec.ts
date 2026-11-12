import { test, expect, type Page } from "./support";

async function language(page: Page, locale: "ru" | "en") {
  await page
    .getByRole("button", {
      name: locale === "en" ? "English" : "Русский",
      exact: true,
    })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}
async function ready(page: Page) {
  await expect(page.locator("main")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".primary-button")).toBeEnabled();
}

for (const collection of ["HASH_MAP", "ARRAY_LIST"])
  test(`${collection}: language preserves paused history, forms, selection and settings without requests`, async ({
    page,
  }) => {
    await page.goto("/");
    await ready(page);
    if (collection === "ARRAY_LIST") {
      await page.locator(".collection-select").selectOption(collection);
      await ready(page);
    }
    const raw = "Русский EN <value> {limit}";
    await page
      .getByLabel(collection === "HASH_MAP" ? "Ключ" : "Элемент", {
        exact: true,
      })
      .fill(raw);
    if (collection === "HASH_MAP")
      await page.getByLabel("Значение", { exact: true }).fill("null");
    const response = page.waitForResponse(
      (r) => r.ok() && r.url().includes("/commands?"),
    );
    await page.locator(".primary-button").click();
    let result = await (await response).json();
    await ready(page);
    const nextResponse = page.waitForResponse(
      (r) => r.ok() && r.url().includes("/commands?"),
    );
    await page.locator(".primary-button").click();
    result = await (await nextResponse).json();
    await ready(page);
    await expect(page.locator("#history option")).toHaveCount(3);
    await page.locator("#history").selectOption("0");
    await ready(page);
    await page.getByRole("button", { name: "В конец", exact: true }).click();
    if (collection === "HASH_MAP") {
      await page.locator(".map-node").first().click();
      await page
        .getByRole("button", { name: "Увеличить масштаб", exact: true })
        .click();
      await page.getByLabel("Физические связи", { exact: true }).check();
      await page.getByLabel("Скрыть пустые", { exact: true }).check();
    } else {
      await page.locator(".array-cell").first().click();
      await page
        .getByLabel("Конструктор ArrayList", { exact: true })
        .selectOption("5");
    }
    const history = await page.locator("#history").inputValue();
    const cursor = await page.getByTestId("step-number").textContent();
    const selected = await page
      .locator(
        collection === "HASH_MAP"
          ? ".map-node.highlighted"
          : '.array-cell[aria-pressed="true"]',
      )
      .count();
    expect(selected).toBe(1);
    const zoom =
      collection === "HASH_MAP"
        ? await page.locator(".zoom-controls > span").textContent()
        : undefined;
    const stableElement = await page
      .locator(
        collection === "HASH_MAP" ? ".hashmap-diagram" : ".array-diagram",
      )
      .elementHandle();
    let requests = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/")) requests++;
    });
    await language(page, "en");
    await expect(page.getByTestId("step-number")).toHaveText(cursor!);
    await expect(page.locator("#history")).toHaveValue(history);
    await expect(
      page.getByLabel(collection === "HASH_MAP" ? "Key" : "Element", {
        exact: true,
      }),
    ).toHaveValue(raw);
    expect(await stableElement!.evaluate((el) => el.isConnected)).toBe(true);
    expect(
      await page
        .locator(
          collection === "HASH_MAP"
            ? ".map-node.highlighted"
            : '.array-cell[aria-pressed="true"]',
        )
        .count(),
    ).toBe(selected);
    if (collection === "HASH_MAP") {
      expect(await page.locator(".zoom-controls > span").textContent()).toBe(
        zoom,
      );
      await expect(
        page.getByLabel("Physical links", { exact: true }),
      ).toBeChecked();
      await expect(
        page.getByLabel("Hide empty", { exact: true }),
      ).toBeChecked();
      await expect(page.getByLabel("Value", { exact: true })).toHaveValue(
        "null",
      );
    } else
      await expect(
        page.getByLabel("ArrayList constructor", { exact: true }),
      ).toHaveValue("5");
    await expect(
      page.getByRole("button", { name: "Play", exact: true }),
    ).toBeVisible();
    expect(requests).toBe(0);
    await language(page, "ru");
    expect(requests).toBe(0);
    const committed = await page.request.get(
      `/api/v1/sessions/${result.sessionId}?snapshotVersion=2`,
    );
    expect((await committed.json()).revision).toBe(result.revision);
    await language(page, "en");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("button", { name: "English", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });

test("active playback keeps its existing timer and inspector state on locale changes", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2030-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2030-01-01T00:00:00Z"));
  await page.goto("/");
  await ready(page);
  await page.getByRole("button", { name: /Красно-чёрное дерево/ }).click();
  await ready(page);
  await page.getByLabel("Скорость воспроизведения").selectOption("0.5");
  await page.clock.runFor(1500);
  const cursor = Number(await page.getByTestId("step-number").textContent());
  let requests = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/")) requests++;
  });
  await language(page, "en");
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Playback speed")).toHaveValue("0.5");
  await page.clock.runFor(600);
  expect(Number(await page.getByTestId("step-number").textContent())).toBe(
    cursor + 1,
  );
  await page
    .getByRole("button", { name: "Collapse player", exact: true })
    .click();
  await page.getByRole("button", { name: "Алгоритм", exact: true }).click();
  await language(page, "ru");
  await expect(
    page.getByRole("button", { name: "Развернуть плеер", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Алгоритм", exact: true }),
  ).toHaveClass(/active/);
  await expect(
    page.getByRole("button", { name: "Пауза", exact: true }),
  ).toBeVisible();
  expect(requests).toBe(0);
});

test("retained errors change language without resetting cooldown or retrying writes", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2030-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2030-01-01T00:00:00Z"));
  await page.goto("/");
  await ready(page);
  await page.route("**/commands?**", (route) =>
    route.fulfill({
      status: 429,
      headers: { "Retry-After": "5" },
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        code: "RATE_LIMITED",
        message: "Не переводить по этой строке",
      }),
    }),
  );
  await page.locator(".primary-button").click();
  await expect(page.getByRole("alert")).toContainText("Слишком много запросов");
  let requests = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/")) requests++;
  });
  await language(page, "en");
  await expect(page.getByRole("alert")).toContainText("Too many requests");
  await expect(
    page.getByRole("button", { name: "Refresh state", exact: true }),
  ).toBeDisabled();
  await page.clock.runFor(5100);
  await expect(
    page.getByRole("button", { name: "Refresh state", exact: true }),
  ).toBeEnabled();
  expect(requests).toBe(0);
  await language(page, "ru");
  await expect(page.getByRole("alert")).toContainText("Слишком много запросов");
  expect(requests).toBe(0);
});

test("switching while a command response is in flight accepts it once in the current locale", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reached!: () => void;
  const intercepted = new Promise<void>((resolve) => {
    reached = resolve;
  });
  await page.route("**/commands?**", async (route) => {
    const response = await route.fetch();
    reached();
    await gate;
    await route.fulfill({ response });
  });
  await page.locator(".primary-button").click();
  await intercepted;
  await expect(page.locator("main")).toHaveAttribute("aria-busy", "true");
  let requests = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/")) requests++;
  });
  await language(page, "en");
  release();
  await ready(page);
  await expect(page.locator("#history option")).toHaveCount(2);
  await page.getByRole("button", { name: "Go to end", exact: true }).click();
  await expect(page.getByTestId("metric-size")).toHaveText("1");
  expect(requests).toBe(0);
});

test("compact language buttons work with keyboard at 320px, with no persistent engine status", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await ready(page);
  const en = page.getByRole("button", { name: "English", exact: true });
  await en.focus();
  await page.keyboard.press("Enter");
  await expect(en).toBeFocused();
  await expect(en).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Русский", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("header")).not.toContainText(
    /engine connected|движок подключён/,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect(await page.title()).toContain("Collections Lab");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /HashMap and ArrayList/,
  );
});

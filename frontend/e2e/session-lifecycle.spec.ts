import { test, expect } from "@playwright/test";

test("switching and constructor changes keep one slot under strict quotas, including delayed and lost replies", async ({
  page,
  context,
}, info) => {
  const ip =
    info.project.name === "desktop" ? "198.51.100.81" : "198.51.100.82";
  await context.setExtraHTTPHeaders({ "X-JCV-Client-IP": ip }); // Dedicated local trusted-proxy fixture.
  let creates = 0,
    resets = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/sessions(?:\?.*)?$/.test(r.url()))
      creates++;
    if (/\/reset(?:\?.*)?$/.test(r.url())) resets++;
  });
  const created = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" && /\/sessions(?:\?.*)?$/.test(r.url()),
  );
  await page.goto("/");
  const initial = await (await created).json();
  const ready = () => expect(page.locator(".primary-button")).toBeEnabled();
  const switchTo = async (type: string) => {
    await page.getByLabel("Коллекция", { exact: true }).selectOption(type);
    await ready();
  };
  await ready();
  for (let i = 0; i < 10; i++) {
    await switchTo("ARRAY_LIST");
    await switchTo("HASH_MAP");
  }
  await switchTo("ARRAY_LIST");
  for (let i = 0; i < 8; i++) {
    await page
      .getByLabel("Конструктор ArrayList")
      .selectOption(i % 2 ? "default" : "0");
    await page
      .getByRole("button", { name: "Создать список", exact: true })
      .click();
    await ready();
    await expect(page.getByTestId("committed-size")).toHaveText("0");
  }
  expect(creates).toBe(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
  let release!: () => void, arrived!: () => void;
  const gate = new Promise<void>((r) => (release = r)),
    atServer = new Promise<void>((r) => (arrived = r));
  await page.route(
    /\/reset(?:\?.*)?$/,
    async (route) => {
      const response = await route.fetch();
      arrived();
      await gate;
      await route.fulfill({ response });
    },
    { times: 1 },
  );
  await page.getByLabel("Коллекция", { exact: true }).selectOption("HASH_MAP");
  await atServer;
  await page
    .getByLabel("Коллекция", { exact: true })
    .selectOption("ARRAY_LIST");
  release();
  await ready();
  await expect(
    page.getByRole("button", { name: "Выполнить add(E)", exact: true }),
  ).toBeEnabled();
  const beforeLost = resets;
  await page.route(
    /\/reset(?:\?.*)?$/,
    async (route) => {
      const response = await route.fetch();
      await response.dispose();
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Создать список", exact: true })
    .click();
  await ready();
  await expect(page.getByRole("alert")).toContainText("Нет ответа");
  expect(resets).toBe(beforeLost + 1);
  expect(creates).toBe(1);
  await page.locator(".primary-button").click();
  await ready();
  await expect(page.getByTestId("committed-size")).toHaveText("1");
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.locator(".primary-button")).toBeEnabled();
  await expect(second.getByTestId("committed-size")).toHaveText("0");
  const current = await (
    await context.request.get(
      `/api/v1/sessions/${initial.id}?snapshotVersion=2`,
    )
  ).json();
  expect(current.id).toBe(initial.id);
  expect(current.collection).toBe("ARRAY_LIST");
  expect(current.state.size).toBe(1);
  // Genuine creation exhaustion remains protected and cannot be bypassed by reset traffic.
  for (let i = 0; i < 4; i++)
    expect(
      (
        await context.request.post("/api/v1/sessions?snapshotVersion=2", {
          data: {},
        })
      ).status(),
    ).toBe(201);
  const limited = await context.request.post(
    "/api/v1/sessions?snapshotVersion=2",
    { data: {} },
  );
  expect(limited.status()).toBe(429);
  expect((await limited.json()).code).toBe("RATE_LIMITED");
  await switchTo("HASH_MAP");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(creates).toBe(1);
});

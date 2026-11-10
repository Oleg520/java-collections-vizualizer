import { test, expect } from "@playwright/test";

test("old backend route 404 preserves the slot and shows an actionable error without retries", async ({
  page,
}) => {
  let creates = 0,
    resets = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/sessions(?:\?.*)?$/.test(r.url()))
      creates++;
  });
  await page.route(/\/reset(?:\?.*)?$/, async (route) => {
    resets++;
    await route.fulfill({
      status: 404,
      contentType: "text/html",
      body: "Not Found",
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Выполнить put" }),
  ).toBeEnabled();
  await page
    .getByLabel("Коллекция", { exact: true })
    .selectOption("ARRAY_LIST");
  await expect(page.getByRole("alert")).toContainText("совместимость версий");
  await expect(page.locator(".primary-button")).toBeDisabled();
  expect(creates).toBe(1);
  expect(resets).toBe(1);
  await page
    .getByRole("button", { name: "Повторить подключение", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Повторить подключение", exact: true }),
  ).toBeEnabled();
  expect(creates).toBe(1);
  expect(resets).toBe(2);
  await page.getByLabel("Коллекция", { exact: true }).selectOption("HASH_MAP");
  await expect(
    page.getByRole("button", { name: "Выполнить put" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Выполнить put" }).click();
  await expect(page.getByTestId("committed-size")).toHaveText("1");
  expect(creates).toBe(1);
  expect(resets).toBe(3);
});
test("confirmed expiry creates exactly one replacement", async ({ page }) => {
  let creates = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/sessions(?:\?.*)?$/.test(r.url()))
      creates++;
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Выполнить put" }),
  ).toBeEnabled();
  await page.route(
    /\/reset(?:\?.*)?$/,
    (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          schemaVersion: 1,
          code: "SESSION_NOT_FOUND",
          message: "Expired",
        }),
      }),
    { times: 1 },
  );
  await page
    .getByLabel("Коллекция", { exact: true })
    .selectOption("ARRAY_LIST");
  await expect(
    page.getByRole("button", { name: "Выполнить add(E)", exact: true }),
  ).toBeEnabled();
  expect(creates).toBe(2);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("an incompatible backend is detected before creating a session or sending a command", async ({
  page,
}) => {
  let writes = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") writes++;
  });
  await page.route("**/api/v1/health", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "UP", version: "old" }),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Несовместимый backend");
  expect(writes).toBe(0);
});

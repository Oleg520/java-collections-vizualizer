import { test, expect } from "@playwright/test";

test("a lost committed response recovers state without retrying rapid commands", async ({
  page,
  request,
}) => {
  const created = page.waitForResponse(
    (response) =>
      /\/sessions$/.test(response.url()) &&
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
    /\/commands\?encoding=compact$/,
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
  await expect(page.getByTestId("committed-size")).toHaveText("1");
  await expect(
    page.getByRole("button", { name: "Выполнить put" }),
  ).toBeEnabled();
  expect(writes).toBe(1);
  await expect(page.getByLabel("История операций")).toHaveValue("-1");
  await expect(page.getByTestId("step-number")).toHaveText("0");
  const response = await request.get(
    `http://127.0.0.1:8080/api/v1/sessions/${session.id}`,
  );
  const committed = await response.json();
  expect(committed.revision).toBe(1);
  expect(committed.state.size).toBe(1);
  await response.dispose();

  // Recovery has released the lock and refreshed revision for an explicit next command.
  await page.getByRole("button", { name: "get()", exact: true }).click();
  await page.getByRole("button", { name: "Выполнить get" }).click();
  await expect(page.getByTestId("operation-result")).toHaveText('"Hello"');
  expect(writes).toBe(2);
  await expect(
    page.getByLabel("История операций").locator("option"),
  ).toHaveCount(2);
});

import { test, expect } from "./support";

test("locale switching preserves a paused trace, form values and Java session without requests", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".primary-button")).toBeEnabled();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await page.getByLabel("Ключ", { exact: true }).fill("Русский EN <value>");
  await page.getByLabel("Значение", { exact: true }).fill("null");
  const response = page.waitForResponse(
    (r) => r.ok() && r.url().includes("/commands?"),
  );
  await page.locator(".primary-button").click();
  const result = await (await response).json();
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  const cursor = await page.getByTestId("step-number").textContent();
  const history = await page.locator("#history").inputValue();
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/")) requests++;
  });
  await page.locator(".language-select").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("step-number")).toHaveText(cursor!);
  await expect(page.locator("#history")).toHaveValue(history);
  await expect(page.getByLabel("Ключ", { exact: true })).toHaveValue(
    "Русский EN <value>",
  );
  await expect(page.getByLabel("Значение", { exact: true })).toHaveValue(
    "null",
  );
  expect(requests).toBe(0);
  expect(result.sessionId).toBeTruthy();
  await page.locator(".language-select").selectOption("ru");
  expect(requests).toBe(0);
  await page.locator(".language-select").selectOption("en");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".language-select")).toHaveValue("en");
});

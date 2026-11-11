import { test, expect, expectServerSize } from "./support";

test("HashMap operation dropdown supports pointer, keyboard and Java put/get/remove", async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize(
    isMobile ? { width: 412, height: 839 } : { width: 1440, height: 720 },
  );
  await page.goto("/");
  const action = page.locator(".primary-button");
  const operation = page.getByRole("combobox", {
    name: "Операция",
    exact: true,
  });
  await expect(action).toBeEnabled();
  await expect(operation).toHaveValue("PUT");
  await expect(page.locator(".operation-tabs")).toHaveCount(0);
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/commands"))
      writes++;
  });

  if (isMobile) await operation.tap();
  else await operation.click();
  const get = page.getByRole("option", { name: "get(K)", exact: true });
  if (isMobile) await get.tap();
  else await get.click();
  await expect(operation).toHaveValue("GET");
  await expect(page.getByLabel("Значение", { exact: true })).toHaveCount(0);
  await expect(action).toHaveAccessibleName("Выполнить get");
  await operation.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(operation).toHaveValue("REMOVE");
  await expect(action).toHaveAccessibleName("Выполнить remove");
  expect(writes).toBe(0);

  async function execute(type: string) {
    const before = writes;
    await operation.selectOption(type);
    expect(writes).toBe(before);
    const response = page.waitForResponse(
      (r) => r.url().includes("/commands?") && r.ok(),
    );
    await action.click();
    const data = await (await response).json();
    await expect(action).toBeEnabled();
    await page.getByRole("button", { name: "В конец", exact: true }).click();
    expect(data.trace.operation.type).toBe(type);
    expect(writes).toBe(before + 1);
    return data.trace;
  }
  await operation.selectOption("PUT");
  await expect(page.getByLabel("Значение", { exact: true })).toHaveValue(
    "Hello",
  );
  await page.getByLabel("Значение", { exact: true }).fill("dropdown value");
  const inserted = await execute("PUT");
  expect(inserted.operation.value).toBe("dropdown value");
  await expectServerSize(page, 1);
  const found = await execute("GET");
  expect(found.result.value).toBe("dropdown value");
  await expect(page.getByTestId("operation-result")).toHaveText(
    '"dropdown value"',
  );
  const removed = await execute("REMOVE");
  expect(removed.result.previousValue).toBe("dropdown value");
  await expectServerSize(page, 0);
  await operation.selectOption("PUT");
  await expect(page.getByLabel("Значение", { exact: true })).toHaveValue(
    "dropdown value",
  );
  await expect(action).toHaveText("Выполнить");
  await page.setViewportSize({ width: 320, height: 740 });
  await expect(operation).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(writes).toBe(3);
});

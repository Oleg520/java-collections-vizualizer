import { test, expect, type Page } from "@playwright/test";

async function ready(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Выполнить put" }),
  ).toBeEnabled();
}
async function finish(page: Page) {
  await page.getByRole("button", { name: "В конец", exact: true }).click();
}

test("GitHub source link points to the public repository", async ({ page }) => {
  await page.goto("/");
  const source = page.getByRole("link", {
    name: "Исходный код проекта на GitHub",
  });
  await expect(source).toHaveAttribute(
    "href",
    "https://github.com/Oleg520/java-collections-vizualizer",
  );
  await expect(source).toHaveAttribute("target", "_blank");
  await expect(source).toHaveAttribute("rel", "noopener noreferrer");
});

test("real Java session, put/get/remove, null and immutable playback", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/commands"))
      writes++;
  });
  await ready(page);
  await expect(page.getByTestId("metric-capacity")).toHaveText("0");
  await page.getByRole("button", { name: "Выполнить put" }).click();
  await expect(page.getByTestId("committed-size")).toHaveText("1");
  await finish(page);
  await expect(page.getByTestId("metric-size")).toHaveText("1");
  await expect(page.getByTestId("metric-capacity")).toHaveText("16");
  await expect(
    page.getByRole("button", { name: 'Узел "Java", список' }),
  ).toBeVisible();
  const number = await page.getByTestId("step-number").textContent();
  await page.getByRole("button", { name: "Шаг назад", exact: true }).click();
  await expect(page.getByTestId("step-number")).not.toHaveText(number!);
  await page.getByRole("button", { name: "Шаг вперёд", exact: true }).click();
  await expect(page.getByTestId("step-number")).toHaveText(number!);
  await page.getByRole("button", { name: "В начало", exact: true }).click();
  await expect(page.getByTestId("metric-capacity")).toHaveText("0");
  await expect(page.getByTestId("committed-size")).toHaveText("1");
  await page
    .getByRole("button", { name: "Воспроизвести", exact: true })
    .click();
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  expect(writes).toBe(1);
  await page.getByRole("button", { name: "get()", exact: true }).click();
  await page.getByRole("button", { name: "Выполнить get" }).click();
  await expect(page.getByTestId("operation-result")).toHaveText('"Hello"');
  await page.getByRole("button", { name: "remove()", exact: true }).click();
  await page.getByRole("button", { name: "Выполнить remove" }).click();
  await expect(page.getByTestId("committed-size")).toHaveText("0");
  await finish(page);
  await expect(page.getByTestId("diagram").getByRole("button")).toHaveCount(0);
  await page.getByRole("button", { name: "put()", exact: true }).click();
  await page.getByLabel("Тип ключа").selectOption("NULL");
  await page.getByLabel("value = null").check();
  await page.getByRole("button", { name: "Выполнить put" }).click();
  await expect(page.getByTestId("committed-size")).toHaveText("1");
  await finish(page);
  await expect(
    page.getByRole("button", { name: "Узел null, список" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("collision, resize, tree, deferred tree and rapid history navigation", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  await page.getByRole("button", { name: /02 Коллизия/ }).click();
  await expect(page.getByTestId("committed-size")).toHaveText("3");
  await finish(page);
  await expect(page.getByTestId("diagram").getByRole("button")).toHaveCount(3);
  await expect(page.locator(".svg-edge-label")).toHaveCount(2);
  await page.getByRole("button", { name: /04 Resize и split/ }).click();
  await expect(page.getByTestId("committed-size")).toHaveText("13");
  await finish(page);
  await expect(page.getByTestId("metric-capacity")).toHaveText("32");
  const split = page
    .locator(".event-row")
    .filter({ hasText: "BUCKET_SPLIT" })
    .first();
  await split.click();
  await expect(page.locator(".split-explanation")).toBeVisible();
  await expect(page.locator(".split-explanation")).toContainText("bucket [1]");
  await page.getByRole("button", { name: /05 Красно-чёрное дерево/ }).click();
  await expect(page.getByTestId("committed-size")).toHaveText("9");
  await finish(page);
  await expect(page.getByTestId("metric-capacity")).toHaveText("64");
  await expect(page.getByText("RB TREE", { exact: true })).toBeVisible();
  await expect(page.locator(".svg-edge-label")).toHaveCount(8);
  expect(await page.locator(".red-node").count()).toBeGreaterThan(0);
  expect(await page.locator(".black-node").count()).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Algorithm", exact: true }).click();
  await expect(page.locator(".algorithm-list")).toContainText("h ^ (h >>> 16)");
  // Let the SVG transitions settle before saving documentation screenshots.
  await page.waitForTimeout(350);
  if (testInfo.project.name === "desktop")
    await page.screenshot({ path: "../docs/hashmap-tree.png", fullPage: true });
  if (testInfo.project.name === "mobile")
    await page.screenshot({
      path: "../docs/hashmap-mobile.png",
      fullPage: true,
    });
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "В начало", exact: true }).click();
    await finish(page);
  }
  await expect(page.getByTestId("committed-size")).toHaveText("9");
  await page.getByRole("button", { name: /06 Почему нет дерева/ }).click();
  await expect(page.getByTestId("operation-result")).toHaveText(
    "9 записей · готово",
  );
  // Wait for this request, since the size is deliberately unchanged.
  await expect(
    page.getByRole("button", { name: /06 Почему нет дерева/ }),
  ).toBeEnabled();
  await finish(page);
  await expect(page.getByTestId("metric-capacity")).toHaveText("32");
  await expect(page.locator(".red-node,.black-node")).toHaveCount(0);
  await page.getByLabel("История операций").selectOption("0");
  await finish(page);
  await expect(page.getByTestId("metric-size")).toHaveText("3");
  await expect(page.getByTestId("committed-size")).toHaveText("9");
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("different tabs own different sessions and invalid input is actionable", async ({
  page,
  context,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Выполнить put" }).click();
  await expect(page.getByTestId("committed-size")).toHaveText("1");
  const second = await context.newPage();
  await ready(second);
  await expect(second.getByTestId("committed-size")).toHaveText("0");
  await second.getByLabel("Тип ключа").selectOption("COLLISION");
  await second.getByRole("textbox", { name: "Ключ", exact: true }).fill("A");
  await second.getByRole("button", { name: "Выполнить put" }).click();
  await expect(second.getByTestId("committed-size")).toHaveText("1");
  await second
    .getByRole("textbox", { name: "hashCode", exact: true })
    .fill("43");
  await second.getByRole("button", { name: "Выполнить put" }).click();
  await expect(second.getByRole("alert")).toContainText(
    "hashCode этого ID уже закреплён: 42",
  );
  await expect(second.getByTestId("committed-size")).toHaveText("1");
  await second.close();
});

import { test, expect, type Locator, type Page } from "@playwright/test";

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator(".primary-button")).toBeEnabled();
}
async function finish(page: Page) {
  await expect(page.locator(".primary-button")).toBeEnabled();
  await page.getByRole("button", { name: "В конец", exact: true }).click();
}
async function noHorizontalOverflow(target: Locator) {
  expect(await target.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
}
function field(details: Locator, name: string) {
  return details
    .locator("dl > div")
    .filter({
      has: details.page().locator("dt", { hasText: new RegExp(`^${name}$`) }),
    })
    .last()
    .locator(":scope > dd");
}

test("compact breadcrumbs, scenario-only sidebar and contextual OpenJDK link", async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize(
    isMobile ? { width: 412, height: 839 } : { width: 1440, height: 900 },
  );
  await ready(page);
  const nav = page.getByRole("navigation", {
    name: "Java Collections Framework",
  });
  const collection = page.getByRole("combobox", {
    name: "Коллекция",
    exact: true,
  });
  await expect(nav).toContainText("Collections");
  await expect(nav.locator(":scope > span").nth(1)).toHaveText("Map");
  await expect(collection).toHaveCount(1);
  await expect(nav.getByRole("combobox")).toHaveCount(1);
  await expect(page.locator(".sidebar select")).toHaveCount(0);
  for (const caption of [
    "Один запуск — весь путь алгоритма.",
    "Каждый сценарий начинает с пустой коллекции.",
  ]) {
    await expect(page.getByText(caption, { exact: true })).toHaveCount(0);
  }
  await expect(page.locator(".sidebar-title")).toBeVisible();
  await expect(
    page.locator(".scenario-button").first(),
  ).toHaveAccessibleDescription(/заменяет содержимое/);
  await expect(collection).toHaveAccessibleDescription(/очищает историю/);
  await expect(page.locator(".app-header a[href*='openjdk']")).toHaveCount(0);
  if (!isMobile) {
    for (const target of [".visualization", ".inspector"]) {
      expect((await page.locator(target).boundingBox())!.y).toBeLessThan(450);
    }
  }
  await page.getByRole("button", { name: /Algorithm/ }).click();
  const source = page.getByRole("link", { name: "Исходник OpenJDK" });
  await expect(source).toHaveAttribute("href", /\/HashMap\.java$/);
  await expect(source).toHaveAttribute("target", "_blank");
  await collection.selectOption("ARRAY_LIST");
  await expect(page.locator(".primary-button")).toBeEnabled();
  await expect(nav.locator(":scope > span").nth(1)).toHaveText("List");
  await expect(source).toHaveAttribute("href", /\/ArrayList\.java$/);
  await expect(page.locator(".scenario-button")).toHaveCount(9);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator(".collection-help summary").click();
  await expect(page.locator(".collection-help p")).toBeVisible();
  await noHorizontalOverflow(page.locator("html"));
  await noHorizontalOverflow(nav);
});

test("themed native menus support pointer/touch, keyboard selection, cancellation and focus", async ({
  page,
  isMobile,
}) => {
  await ready(page);
  const collection = page.getByRole("combobox", {
    name: "Коллекция",
    exact: true,
  });
  if (isMobile) await collection.tap();
  else await collection.click();
  const selected = page.getByRole("option", { name: "HashMap", exact: true });
  await expect(selected).toBeVisible();
  await expect(selected).toHaveCSS("background-color", "rgb(38, 51, 32)");
  if (isMobile) await selected.tap();
  else await selected.click();
  await page.mouse.move(0, 0);
  await expect(collection).not.toHaveCSS("outline-style", "solid");
  await expect(collection).toHaveCSS("border-color", "rgb(53, 64, 50)");
  await collection.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(collection).toBeFocused();
  await expect(collection).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Space");
  await page.keyboard.press("End");
  await page.keyboard.press("Escape");
  await expect(collection).toHaveValue("HASH_MAP");
  await expect(collection).toBeFocused();
  await page.keyboard.press("Space");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(collection).toHaveValue("ARRAY_LIST");
  await expect(page.locator(".primary-button")).toBeEnabled();
  const operation = page.getByRole("combobox", {
    name: "Операция",
    exact: true,
  });
  if (isMobile) await operation.tap();
  else await operation.click();
  const get = page.getByRole("option", { name: "get(index)", exact: true });
  if (isMobile) await get.tap();
  else await get.click();
  await expect(operation).toHaveValue("GET_AT");
  await expect(page.getByLabel("Индекс", { exact: true })).toBeVisible();
  await noHorizontalOverflow(page.locator("html"));
});

test("ArrayList constructor is a separate keyboard-accessible replacement workflow", async ({
  page,
  isMobile,
}) => {
  await ready(page);
  await page
    .getByLabel("Коллекция", { exact: true })
    .selectOption("ARRAY_LIST");
  await expect(page.locator(".primary-button")).toBeEnabled();
  await page.locator(".primary-button").click();
  await finish(page);
  await expect(page.getByTestId("committed-size")).toHaveText("1");
  const constructor = page.getByRole("combobox", {
    name: "Конструктор ArrayList",
  });
  await expect(constructor).toBeVisible();
  expect((await constructor.boundingBox())!.width).toBeLessThanOrEqual(240);
  if (!isMobile) {
    const create = page.getByRole("button", {
      name: "Создать список",
      exact: true,
    });
    expect(
      Math.abs(
        (await constructor.boundingBox())!.y - (await create.boundingBox())!.y,
      ),
    ).toBeLessThan(1);
  }
  await expect(constructor).toHaveAccessibleDescription(
    /Заменит текущий список/,
  );
  await expect(
    page.locator(".array-command-form").getByRole("button"),
  ).toHaveCount(1);
  await constructor.selectOption("5");
  await page
    .getByRole("button", { name: "Создать список", exact: true })
    .click();
  await expect(page.getByTestId("committed-size")).toHaveText("0");
  await expect(page.getByTestId("metric-capacity")).toHaveText("5");
  await expect(page.getByTestId("step-number")).toHaveText("0");
  await expect(
    page.getByLabel("История операций").locator("option"),
  ).toHaveCount(1);
  await page.setViewportSize({ width: 320, height: 740 });
  await noHorizontalOverflow(page.locator("html"));
  await noHorizontalOverflow(page.locator(".array-constructor"));
});

test("collection help dismisses on mouse leave, outside click and Escape while preserving keyboard and touch", async ({
  page,
  isMobile,
}) => {
  await ready(page);
  const help = page.locator(".collection-help");
  const trigger = help.locator("summary");
  const text = help.locator("p");
  if (isMobile) {
    await trigger.tap();
    await expect(text).toBeVisible();
    await text.tap();
    await expect(text).toBeVisible();
    await page.locator(".breadcrumbs > span").first().tap();
  } else {
    await trigger.click();
    await text.hover();
    await expect(text).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(text).toBeHidden();
    await trigger.click();
    await page.locator(".breadcrumbs > span").first().click();
  }
  await expect(text).toBeHidden();
  await trigger.focus();
  await page.keyboard.press("Space");
  await expect(text).toBeVisible();
  await trigger.hover();
  await page.mouse.move(0, 0);
  await expect(text).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(text).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(text).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(text).toBeHidden();
  await expect(trigger).not.toBeFocused();
});

test("technical details preserve typed results, nested elements, quoted strings and null without clipping", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByLabel("Коллекция", { exact: true })
    .selectOption("ARRAY_LIST");
  await expect(page.locator(".primary-button")).toBeEnabled();
  const details = page.getByRole("region", {
    name: "Технические детали",
    exact: true,
  });
  await page.locator(".primary-button").click();
  await finish(page);
  await expect(field(details, "kind")).toHaveText('"BOOLEAN"');
  await expect(field(details, "booleanValue")).toHaveText("true");
  await expect(field(details, "element")).toHaveText("null");
  const longValue = '<Java> "null" & ' + "Ж".repeat(100);
  await page.getByLabel("Элемент", { exact: true }).fill(longValue);
  await page.locator(".primary-button").click();
  await finish(page);
  await page.getByLabel("Тип элемента").selectOption("NULL");
  await page.locator(".primary-button").click();
  await finish(page);
  await page.getByLabel("Операция", { exact: true }).selectOption("GET_AT");
  await page.getByLabel("Индекс", { exact: true }).fill("1");
  await page.locator(".primary-button").click();
  await finish(page);
  await expect(field(details, "kind")).toHaveText('"ELEMENT"');
  await expect(field(details, "type")).toHaveText('"STRING"');
  await expect(field(details, "value")).toHaveText(JSON.stringify(longValue));
  await noHorizontalOverflow(details);
  await page.locator(".event-row").filter({ hasText: "ELEMENT_READ" }).click();
  await expect(field(details, "type")).toHaveText('"STRING"');
  await expect(field(details, "value")).toHaveText(JSON.stringify(longValue));
  await noHorizontalOverflow(details);
  await page.getByLabel("Индекс", { exact: true }).fill("2");
  await page.locator(".primary-button").click();
  await finish(page);
  await expect(field(details, "type")).toHaveText('"NULL"');
  await expect(field(details, "value")).toHaveText("null");
  await expect(details.locator("script")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 740 });
  await noHorizontalOverflow(details);
  await noHorizontalOverflow(page.locator("html"));
});

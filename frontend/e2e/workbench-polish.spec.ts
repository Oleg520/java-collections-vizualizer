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
  await expect(page.locator(".app-header .breadcrumbs")).toHaveCount(0);
  await expect(
    page.locator("main > .collection-heading > .breadcrumbs"),
  ).toHaveCount(1);
  await expect(
    page.locator("main > .collection-heading > .collection-context"),
  ).toHaveCount(1);
  await expect(nav.getByRole("combobox")).toHaveCount(1);
  await expect(page.locator(".app-header")).toHaveCSS("position", "sticky");
  const header = (await page.locator(".app-header").boundingBox())!;
  expect(header.height).toBe(isMobile ? 62 : 76);
  expect(
    (await page.locator(".visualization").boundingBox())!.height,
  ).toBeCloseTo(isMobile ? 540 : 576, 0);
  if (!isMobile) {
    const navigation = (await nav.boundingBox())!;
    const context = (await page.locator(".collection-context").boundingBox())!;
    expect(navigation.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(navigation.x + navigation.width).toBeLessThan(context.x);
    expect(
      Math.abs(
        navigation.y + navigation.height / 2 - context.y - context.height / 2,
      ),
    ).toBeLessThan(1);
  }
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

test("compact workbench navigation and model help share a responsive row below the header", async ({
  page,
}) => {
  await ready(page);
  const nav = page.getByRole("navigation", {
    name: "Java Collections Framework",
  });
  const collection = nav.getByRole("combobox", {
    name: "Коллекция",
    exact: true,
  });
  const github = page.getByRole("link", {
    name: "Исходный код проекта на GitHub",
  });
  for (const width of [1440, 1024, 768, 681, 680, 412, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page.evaluate(() => scrollTo(0, 0));
    await expect(nav).toBeInViewport({ ratio: 1 });
    await expect(collection).toBeInViewport({ ratio: 1 });
    await expect(github).toBeInViewport({ ratio: 1 });
    const navigation = (await nav.boundingBox())!;
    const model = (await page.locator(".collection-context").boundingBox())!;
    expect(
      Math.abs(
        navigation.y + navigation.height / 2 - model.y - model.height / 2,
      ),
    ).toBeLessThan(1);
    expect(navigation.x + navigation.width).toBeLessThanOrEqual(model.x);
    await noHorizontalOverflow(page.locator("html"));
    await noHorizontalOverflow(page.locator(".app-header"));
  }
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(github).toBeInViewport({ ratio: 1 });
  await collection.focus();
  await expect(collection).toBeInViewport({ ratio: 1 });
  await collection.selectOption("ARRAY_LIST");
  await expect(page.locator(".primary-button")).toBeEnabled();
  await expect(nav.locator(":scope > span").nth(1)).toHaveText("List");
  await expect(page.getByTestId("committed-size")).toHaveText("0");
  await collection.focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(".collection-help summary")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(collection).toBeFocused();
  await expect(collection).toHaveCSS("outline-style", "solid");
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
  const constructorBox = (await constructor.boundingBox())!;
  const labelBox = (await page
    .locator('label[for="array-constructor"] > span')
    .boundingBox())!;
  const create = page.getByRole("button", {
    name: "Создать",
    exact: true,
  });
  const createBox = (await create.boundingBox())!;
  const hint = page.locator("#constructor-replacement-hint");
  expect(constructorBox.width).toBeLessThanOrEqual(240);
  expect(labelBox.y + labelBox.height).toBeLessThan(constructorBox.y);
  expect((await hint.boundingBox())!.y).toBeGreaterThanOrEqual(
    Math.max(
      constructorBox.y + constructorBox.height,
      createBox.y + createBox.height,
    ),
  );
  if (!isMobile) {
    expect(Math.abs(constructorBox.y - createBox.y)).toBeLessThan(1);
    expect(createBox.x).toBeGreaterThan(
      constructorBox.x + constructorBox.width,
    );
  }
  await expect(constructor).toHaveAccessibleDescription(
    "Создание новой коллекции заменит текущую и очистит историю операций",
  );
  await expect(
    page.locator(".array-command-form").getByRole("button"),
  ).toHaveCount(1);
  await constructor.selectOption("5");
  await page
    .getByRole("button", { name: "Создать", exact: true })
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

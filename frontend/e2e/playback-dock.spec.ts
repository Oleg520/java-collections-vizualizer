import { test, expect, type Locator, type Page } from "@playwright/test";

async function dockIsAvailable(page: Page) {
  const dock = page.getByRole("region", {
    name: "Управление воспроизведением",
    exact: true,
  });
  const viewport = page.viewportSize()!;
  await expect
    .poll(async () => {
      const r = (await page.locator(".playback-dock").boundingBox())!;
      return Math.round(r.y + r.height);
    })
    .toBe(viewport.height);
  const bounds = await page.locator(".playback-dock").boundingBox();
  expect(bounds!.y).toBeGreaterThan(0);
  expect(bounds!.y + bounds!.height).toBeCloseTo(viewport.height, 0);
  const scrollArea = await page.locator(".page-scroll").boundingBox();
  expect(scrollArea!.y + scrollArea!.height).toBeLessThanOrEqual(bounds!.y);
  for (const control of await dock.locator("button, input, select").all()) {
    await expect(control).toBeInViewport({ ratio: 1 });
    const rect = (await control.boundingBox())!;
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
  }
  await expect(
    dock.getByRole("region", { name: "Пояснение текущего шага" }),
  ).toBeInViewport({ ratio: 1 });
  await expect(dock.getByLabel("История операций")).toHaveCount(0);
  return bounds!;
}

async function reachableAboveDock(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const rect = (await target.boundingBox())!;
  const dock = (await page.locator(".playback-dock").boundingBox())!;
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.y + rect.height).toBeLessThanOrEqual(dock.y + 1);
  // A visible target must also receive pointer input, not sit underneath the dock.
  expect(
    await target.evaluate((element) => {
      const r = element.getBoundingClientRect();
      return element.contains(
        document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
      );
    }),
  ).toBe(true);
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`playback stays at the viewport bottom through tree growth and scrolling (${reducedMotion})`, async ({
    page,
    isMobile,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto("/");
    await expect(page.locator(".primary-button")).toBeEnabled();
    await dockIsAvailable(page);
    await expect(
      page.getByRole("button", { name: "Воспроизвести", exact: true }),
    ).toBeDisabled();

    await page.getByRole("button", { name: /05 Красно-чёрное дерево/ }).click();
    await expect(page.getByTestId("committed-size")).toHaveText("9");
    await page.getByRole("button", { name: "В начало", exact: true }).click();
    const beforeGrowth = await dockIsAvailable(page);
    await page.getByRole("button", { name: "В конец", exact: true }).click();
    await expect(page.getByTestId("metric-size")).toHaveText("9");
    const afterGrowth = await dockIsAvailable(page);
    expect(afterGrowth.y).toBeCloseTo(beforeGrowth.y, 0);

    const scrollArea = page.locator(".page-scroll");
    await scrollArea.evaluate((el) => (el.scrollTop = 0));
    await page.mouse.move(page.viewportSize()!.width - 20, 30);
    await page.mouse.wheel(0, 350);
    await expect
      .poll(() => scrollArea.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    await dockIsAvailable(page);
    await reachableAboveDock(page, page.getByLabel("История операций"));
    await reachableAboveDock(page, page.locator(".technical-details"));
    await reachableAboveDock(page, page.locator(".page-footer"));
    await dockIsAvailable(page);

    // Focus, keyboard stepping and touch stay in the dock without scrolling it away.
    await page.getByRole("button", { name: "В начало", exact: true }).click();
    await page
      .getByRole("link", { name: "К управлению воспроизведением" })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("region", {
        name: "Управление воспроизведением",
        exact: true,
      }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "В начало", exact: true }),
    ).toBeFocused();
    const next = page.getByRole("button", { name: "Шаг вперёд", exact: true });
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("step-number")).toHaveText("2");
    await page.getByLabel("Позиция воспроизведения").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("step-number")).toHaveText("3");
    if (isMobile) {
      await next.tap();
      await expect(page.getByTestId("step-number")).toHaveText("4");
    }
    await page.getByLabel("Скорость воспроизведения").selectOption("4");
    await page
      .getByRole("button", { name: "Воспроизвести", exact: true })
      .click();
    const step = await page.getByTestId("step-number").innerText();
    await expect(page.getByTestId("step-number")).not.toHaveText(step);
    await page.getByRole("button", { name: "Пауза", exact: true }).click();
    await dockIsAvailable(page);
  });

  test(`ArrayList copying and long explanations remain usable on short screens (${reducedMotion})`, async ({
    page,
    isMobile,
  }) => {
    await page.setViewportSize(
      isMobile ? { width: 320, height: 420 } : { width: 1100, height: 360 },
    );
    await page.emulateMedia({ reducedMotion });
    await page.goto("/");
    await expect(page.locator(".primary-button")).toBeEnabled();
    await page
      .getByLabel("Коллекция", { exact: true })
      .selectOption("ARRAY_LIST");
    await expect(page.locator(".primary-button")).toBeEnabled();
    await page.locator(".scenario-button").nth(2).click();
    await expect(page.getByTestId("committed-size")).toHaveText("11");
    await page.getByRole("button", { name: "В конец", exact: true }).click();
    await page
      .locator(".event-row")
      .filter({ hasText: "ARRAY_COPY_COMPLETED" })
      .last()
      .click();
    await expect(
      page.getByRole("region", { name: "Старый elementData" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Новый буфер" }),
    ).toBeVisible();
    await dockIsAvailable(page);
    // The bottom of the second buffer and the end of the page remain reachable.
    await reachableAboveDock(page, page.locator(".array-step"));
    await reachableAboveDock(page, page.locator(".page-footer"));

    await page
      .getByLabel("Элемент", { exact: true })
      .fill("Длинное значение ".repeat(8).slice(0, 128));
    await page.locator(".primary-button").click();
    await expect(page.getByTestId("committed-size")).toHaveText("12");
    await page.getByRole("button", { name: "В начало", exact: true }).click();
    const explanation = page.getByRole("region", {
      name: "Пояснение текущего шага",
    });
    await expect(explanation).toContainText("Длинное значение");
    await explanation.focus();
    await page.keyboard.press("End");
    await expect(explanation).toBeFocused();
    if (isMobile) {
      expect(
        await explanation.evaluate((el) => el.scrollHeight > el.clientHeight),
      ).toBe(true);
      await expect
        .poll(() => explanation.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(0);
    }
    await dockIsAvailable(page);
    // Resizing to landscape recalculates the scroll area without stale spacer heights.
    await page.setViewportSize({ width: 844, height: 390 });
    await dockIsAvailable(page);
    await reachableAboveDock(page, page.locator(".page-footer"));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

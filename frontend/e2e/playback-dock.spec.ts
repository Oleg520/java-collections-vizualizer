import { test, expect, type Locator, type Page } from "@playwright/test";

async function dockIsAvailable(page: Page, expanded = true) {
  const dock = page.getByRole("region", {
    name: "Управление воспроизведением",
    exact: true,
  });
  const viewport = page.viewportSize()!;
  await expect
    .poll(async () => {
      const r = (await dock.boundingBox())!;
      const gap = viewport.height - r.y - r.height;
      return gap >= 8 && gap <= 32;
    })
    .toBe(true);
  const bounds = (await dock.boundingBox())!;
  expect(bounds.y).toBeGreaterThan(0);
  expect(bounds.width).toBeLessThanOrEqual(950);
  if (
    expanded &&
    (await page.locator(".canvas-column").boundingBox())!.width >= 950
  ) {
    expect(bounds.width).toBeGreaterThanOrEqual(850);
  }
  expect(bounds.x).toBeGreaterThanOrEqual(8);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width - 8);
  await expect
    .poll(async () => {
      const main = (await page.locator(".canvas-column").boundingBox())!;
      const card = (await dock.boundingBox())!;
      return Math.abs(card.x + card.width / 2 - main.x - main.width / 2);
    })
    .toBeLessThan(1);
  for (const control of await dock
    .locator("button, input, select")
    .filter({ visible: true })
    .all()) {
    await expect(control).toBeInViewport({ ratio: 1 });
    expect(
      await control.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const card = element.closest(".playback-dock")!.getBoundingClientRect();
        return rect.left >= card.left && rect.right <= card.right;
      }),
    ).toBe(true);
  }
  const explanation = dock.getByRole("region", {
    name: "Пояснение текущего шага",
  });
  if (expanded) {
    await expect(explanation).toBeInViewport({ ratio: 1 });
    await expect(dock.getByLabel("Позиция воспроизведения")).toBeVisible();
    await expect(dock.getByLabel("Скорость воспроизведения")).toBeVisible();
  } else {
    await expect(explanation).toBeHidden();
    await expect(dock.getByLabel("Позиция воспроизведения")).toBeHidden();
    await expect(dock.getByLabel("Скорость воспроизведения")).toBeHidden();
  }
  await expect(dock.getByLabel("История операций")).toHaveCount(0);
  await expect(
    page.locator(".inspector").getByLabel("История операций"),
  ).toHaveCount(1);
  await expect(
    page.locator(".canvas-column").getByLabel("История операций"),
  ).toHaveCount(0);
  await expect(page.locator(".page-footer")).toHaveCount(0);
  return bounds;
}

async function reachableAboveDock(page: Page, target: Locator) {
  await target.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await expect
    .poll(async () => {
      const rect = (await target.boundingBox())!;
      const dock = (await page.locator(".playback-dock").boundingBox())!;
      return rect.y >= 0 && rect.y + rect.height <= dock.y;
    })
    .toBe(true);
  expect(
    await target.evaluate((element) => {
      const r = element.getBoundingClientRect();
      return element.contains(
        document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
      );
    }),
  ).toBe(true);
}

async function pageEndIsReachable(page: Page) {
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  const viewport = page.viewportSize()!;
  const details = page.locator(".technical-details > :last-child");
  await reachableAboveDock(page, details);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  if (viewport.width > 680) {
    await expect
      .poll(async () => {
        const sidebar = (await page.locator(".sidebar").boundingBox())!;
        return Math.abs(sidebar.y + sidebar.height - viewport.height);
      })
      .toBeLessThanOrEqual(1);
  }
  if (viewport.width > 1000) {
    await expect(page.locator(".sidebar-bottom")).toContainText(
      "Java — источник истины.",
    );
    await expect(page.locator(".sidebar-bottom")).toContainText(
      "React — представление.",
    );
  }
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`collapse preserves the selected trace, cursor and active playback (${reducedMotion})`, async ({
    page,
    isMobile,
  }) => {
    await page.emulateMedia({ reducedMotion });
    if (isMobile) await page.setViewportSize({ width: 320, height: 740 });
    let writes = 0;
    page.on("request", (r) => {
      if (r.method() === "POST") writes++;
    });
    await page.goto("/");
    await expect(page.locator(".primary-button")).toBeEnabled();
    await page.getByRole("button", { name: /05 Красно-чёрное дерево/ }).click();
    await expect(page.getByTestId("committed-size")).toHaveText("9");
    await page.locator(".event-row").nth(20).click();
    const position = await page.getByTestId("step-number").innerText();
    const history = await page.getByLabel("История операций").inputValue();
    const originalWrites = writes;
    const expanded = await dockIsAvailable(page);
    const collapse = page.getByRole("button", {
      name: "Свернуть плеер",
      exact: true,
    });
    await collapse.focus();
    await page.keyboard.press("Enter");
    const expand = page.getByRole("button", {
      name: "Развернуть плеер",
      exact: true,
    });
    await expect(expand).toBeFocused();
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    const compact = await dockIsAvailable(page, false);
    expect(compact.height).toBeLessThan(expanded.height / 2);
    await expect(page.getByTestId("step-number")).toHaveText(position);
    await reachableAboveDock(page, page.getByLabel("История операций"));
    await pageEndIsReachable(page);
    const next = page.getByRole("button", { name: "Шаг вперёд", exact: true });
    if (isMobile) await next.tap();
    else await next.click();
    await expect(page.getByTestId("step-number")).toHaveText(
      String(Number(position) + 1),
    );
    await expand.click();
    await expect(
      page.getByRole("button", { name: "Свернуть плеер", exact: true }),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByLabel("История операций")).toHaveValue(history);
    await page.getByLabel("Скорость воспроизведения").selectOption("0.5");
    await page
      .getByRole("button", { name: "Воспроизвести", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Свернуть плеер", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Пауза", exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () =>
        Number(await page.getByTestId("step-number").innerText()),
      )
      .toBeGreaterThan(Number(position) + 1);
    await page
      .getByRole("button", { name: "Развернуть плеер", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Пауза", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Пауза", exact: true }).click();
    await dockIsAvailable(page);
    await expect(page.getByLabel("История операций")).toHaveValue(history);
    expect(writes).toBe(originalWrites);
  });
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
    if (!isMobile) {
      // Resize the real workspace without implementing the future sidebar toggle.
      await page
        .locator("main")
        .evaluate((el) => (el.style.width = "calc(100% - 100px)"));
      await dockIsAvailable(page);
      await page.locator("main").evaluate((el) => (el.style.width = ""));
      await dockIsAvailable(page);
    }

    await page.evaluate(() => scrollTo(0, 0));
    await page.mouse.move(page.viewportSize()!.width - 20, 30);
    await page.mouse.wheel(0, 350);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await dockIsAvailable(page);
    await reachableAboveDock(page, page.getByLabel("История операций"));
    // Browser focus must uncover a control that was underneath the floating card.
    await page.getByRole("button", { name: "В начало", exact: true }).focus();
    await page.getByLabel("Скрыть пустые").evaluate((el) => {
      const r = el.getBoundingClientRect();
      const dock = document.getElementById("playback")!.getBoundingClientRect();
      scrollBy(0, r.top + r.height / 2 - dock.top - dock.height / 2);
    });
    await page.getByLabel("Скрыть пустые").focus();
    await expect
      .poll(async () => {
        const r = (await page.getByLabel("Скрыть пустые").boundingBox())!;
        return (
          r.y + r.height <=
          (await page.locator(".playback-dock").boundingBox())!.y
        );
      })
      .toBe(true);
    await reachableAboveDock(page, page.locator(".technical-details"));
    await pageEndIsReachable(page);
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
    await pageEndIsReachable(page);

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
    await pageEndIsReachable(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

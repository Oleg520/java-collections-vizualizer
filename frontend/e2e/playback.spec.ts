import {
  test,
  expectServerSize,
  expect,
  type Locator,
  type Page,
} from "./support";

async function playerIsAvailable(page: Page, expanded = true) {
  const player = page.getByRole("region", {
    name: "Управление воспроизведением",
    exact: true,
  });
  await player.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await expect(player).toHaveCSS("position", "static");
  const bounds = (await player.boundingBox())!;
  const column = (await page.locator(".canvas-column").boundingBox())!;
  expect(bounds.x).toBeCloseTo(column.x, 0);
  expect(bounds.width).toBeCloseTo(column.width, 0);
  expect(
    await player.evaluate((el) =>
      el.previousElementSibling?.matches(
        ".visualization,.array-diagram,.connecting",
      ),
    ),
  ).toBe(true);
  const diagram = (await page
    .locator(".canvas-column > :first-child")
    .boundingBox())!;
  expect(bounds.y - diagram.y - diagram.height).toBeCloseTo(12, 0);
  for (const control of await player
    .locator("button, input, select")
    .filter({ visible: true })
    .all()) {
    await expect(control).toBeInViewport({ ratio: 1 });
    expect(
      await control.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const card = element.closest(".playback")!.getBoundingClientRect();
        return rect.left >= card.left && rect.right <= card.right;
      }),
    ).toBe(true);
  }
  const explanation = player.getByRole("region", {
    name: "Пояснение текущего шага",
  });
  if (expanded) {
    await expect(explanation).toBeInViewport({ ratio: 1 });
    await expect(player.getByLabel("Позиция воспроизведения")).toBeVisible();
    await expect(player.getByLabel("Скорость воспроизведения")).toBeVisible();
  } else {
    await expect(explanation).toBeHidden();
    await expect(player.getByLabel("Позиция воспроизведения")).toBeHidden();
    await expect(player.getByLabel("Скорость воспроизведения")).toBeHidden();
  }
  await expect(player.getByLabel("История операций")).toHaveCount(0);
  await expect(
    page.locator(".inspector").getByLabel("История операций"),
  ).toHaveCount(1);
  await expect(
    page.locator(".canvas-column").getByLabel("История операций"),
  ).toHaveCount(0);
  await expect(page.locator(".page-footer")).toHaveCount(0);
  return bounds;
}

async function contentIsReachable(page: Page, target: Locator) {
  await target.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await expect
    .poll(async () => {
      const rect = (await target.boundingBox())!;
      return (
        rect.y >= (await page.locator(".app-header").boundingBox())!.height &&
        rect.y + rect.height <= page.viewportSize()!.height
      );
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
  // A structured result can exceed the details pane. Reach its final value,
  // rather than requiring the entire nested description list to fit at once.
  const lastField = page.locator(".technical-details dd").last();
  const details = (await lastField.count())
    ? lastField
    : page.locator(".technical-details > :last-child");
  await contentIsReachable(page, details);
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
    const remaining = await page.locator("main").evaluate((main) => {
      const columns = [...main.querySelectorAll(".canvas-column,.inspector")];
      return (
        main.getBoundingClientRect().bottom -
        Math.max(...columns.map((el) => el.getBoundingClientRect().bottom))
      );
    });
    // Only the normal main padding follows the columns; no playback spacer remains.
    expect(remaining).toBeLessThanOrEqual(24);
  }
}

test("short ArrayList layouts retain bounded panes without redundant bottom space", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".primary-button")).toBeEnabled();
  await page
    .getByLabel("Коллекция", { exact: true })
    .selectOption("ARRAY_LIST");
  await expect(page.locator(".primary-button")).toBeEnabled();
  for (const state of ["empty", "first-add"]) {
    if (state === "first-add") {
      await page.locator(".primary-button").click();
      await expectServerSize(page, 1);
      await page.getByRole("button", { name: "В конец", exact: true }).click();
    }
    for (const expanded of [true, false]) {
      if (!expanded)
        await page
          .getByRole("button", { name: "Свернуть плеер", exact: true })
          .click();
      await playerIsAvailable(page, expanded);
      await pageEndIsReachable(page);
      // A short trace retains the same bounded workbench pane as a long one (#59).
      expect(
        (await page.locator(".inspector").boundingBox())!.height,
      ).toBeCloseTo(
        (await page
          .locator(
            page.viewportSize()!.width > 1000
              ? ".canvas-column"
              : ".array-diagram",
          )
          .boundingBox())!.height,
        0,
      );
      await contentIsReachable(page, page.locator(".array-buffer-heading"));
    }
    await page
      .getByRole("button", { name: "Развернуть плеер", exact: true })
      .click();
  }
});

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
    await expectServerSize(page, 9);
    await page.locator(".event-row").nth(20).click();
    const position = await page.getByTestId("step-number").innerText();
    const history = await page.getByLabel("История операций").inputValue();
    const originalWrites = writes;
    const expanded = await playerIsAvailable(page);
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
    const compact = await playerIsAvailable(page, false);
    expect(compact.height).toBeLessThan(expanded.height);
    const transportHeight = await page
      .locator(".transport")
      .evaluate((el) => el.getBoundingClientRect().height);
    const chromeHeight = await page.locator(".playback").evaluate((el) => {
      const s = getComputedStyle(el);
      return (
        parseFloat(s.paddingTop) +
        parseFloat(s.paddingBottom) +
        parseFloat(s.borderTopWidth) +
        parseFloat(s.borderBottomWidth)
      );
    });
    expect(compact.height).toBeCloseTo(transportHeight + chromeHeight, 0);
    await expect(page.getByTestId("step-number")).toHaveText(position);
    await contentIsReachable(page, page.getByLabel("История операций"));
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
    await playerIsAvailable(page);
    await expect(page.getByLabel("История операций")).toHaveValue(history);
    expect(writes).toBe(originalWrites);
  });
  test(`playback stays below the bounded diagram through tree growth and scrolling (${reducedMotion})`, async ({
    page,
    isMobile,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto("/");
    await expect(page.locator(".primary-button")).toBeEnabled();
    await playerIsAvailable(page);
    await expect(
      page.getByRole("button", { name: "Воспроизвести", exact: true }),
    ).toBeDisabled();

    await page.getByRole("button", { name: /05 Красно-чёрное дерево/ }).click();
    await expectServerSize(page, 9);
    await page.getByRole("button", { name: "В начало", exact: true }).click();
    await playerIsAvailable(page);
    const beforeGrowth = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    await page.getByRole("button", { name: "В конец", exact: true }).click();
    await expect(page.getByTestId("metric-size")).toHaveText("9");
    await playerIsAvailable(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBe(beforeGrowth);
    if (!isMobile) {
      // CSS layout follows a real workspace width change without measured offsets.
      await page
        .locator("main")
        .evaluate((el) => (el.style.width = "calc(100% - 100px)"));
      await playerIsAvailable(page);
      await page.locator("main").evaluate((el) => (el.style.width = ""));
      await playerIsAvailable(page);
    }

    await page.evaluate(() => scrollTo(0, 0));
    await page.mouse.move(page.viewportSize()!.width - 20, 30);
    await page.mouse.wheel(0, 350);
    if (
      await page.evaluate(
        () => document.documentElement.scrollHeight > innerHeight,
      )
    ) {
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    } else {
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    }
    await playerIsAvailable(page);
    await contentIsReachable(page, page.getByLabel("История операций"));
    await page.getByLabel("Скрыть пустые").focus();
    await contentIsReachable(page, page.getByLabel("Скрыть пустые"));
    await contentIsReachable(page, page.locator(".technical-details"));
    await pageEndIsReachable(page);
    await playerIsAvailable(page);

    // The skip link reaches the inline player; keyboard stepping and touch retain focus.
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
    await playerIsAvailable(page);
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
    await expectServerSize(page, 11);
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
    await playerIsAvailable(page);
    // The bottom of the second buffer and the end of the page remain reachable.
    await contentIsReachable(page, page.locator(".array-step"));
    await pageEndIsReachable(page);

    await page
      .getByLabel("Элемент", { exact: true })
      .fill("Длинное значение ".repeat(8).slice(0, 128));
    await page.locator(".primary-button").click();
    await expectServerSize(page, 12);
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
    await playerIsAvailable(page);
    // Responsive reflow keeps the player attached and the final content reachable.
    await page.setViewportSize({ width: 844, height: 390 });
    // Mobile emulation applies the new CSS viewport on the next rendering frame.
    // Finish that reflow before scrolling the player into view.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await playerIsAvailable(page);
    await pageEndIsReachable(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

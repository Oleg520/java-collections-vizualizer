import { test, expect, type Page, type Locator } from "@playwright/test";
import type { CompactSessionTrace } from "../src/api/trace/decodeTrace";

async function geometry(page: Page) {
  return page.evaluate(() => ({
    page: document.documentElement.scrollHeight,
    inspector: document.querySelector(".inspector")!.getBoundingClientRect()
      .height,
    canvas: document
      .querySelector(".visualization,.array-diagram")!
      .getBoundingClientRect().height,
  }));
}

async function accessible(page: Page, target: Locator) {
  await target.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await expect
    .poll(() =>
      target.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        );
      }),
    )
    .toBe(true);
}

async function tree(page: Page) {
  const response = page.waitForResponse((r) =>
    r.url().includes("/scenarios/treeify?"),
  );
  await page.getByRole("button", { name: /05 Красно-чёрное дерево/ }).click();
  const data: CompactSessionTrace = await (await response).json();
  await expect(page.getByTestId("committed-size")).toHaveText("9");
  return data.trace.steps;
}

for (const compact of [false, true]) {
  test(`workbench height stays stable across short/long traces and 2/7 fields (${compact ? "short/narrow" : "standard"})`, async ({
    page,
    isMobile,
  }) => {
    await page.setViewportSize(
      isMobile
        ? { width: compact ? 320 : 412, height: compact ? 740 : 839 }
        : { width: 1440, height: compact ? 480 : 900 },
    );
    await page.emulateMedia({
      reducedMotion: compact ? "reduce" : "no-preference",
    });
    await page.goto("/");
    await expect(page.locator(".primary-button")).toBeEnabled();
    const empty = await geometry(page);
    const steps = await tree(page);
    expect(await geometry(page)).toEqual(empty);
    const two = steps.findIndex((s) => Object.keys(s.details).length === 2);
    const seven = steps.findIndex((s) => Object.keys(s.details).length === 7);
    expect(two).toBeGreaterThanOrEqual(0);
    expect(seven).toBeGreaterThanOrEqual(0);
    for (const expanded of [true, false]) {
      if (!expanded)
        await page
          .getByRole("button", { name: "Свернуть плеер", exact: true })
          .click();
      const baseline = await geometry(page);
      if (!isMobile) {
        expect(
          await page.locator("main").evaluate((main) => {
            const inspector = main.querySelector(".inspector")!;
            return Math.abs(
              main.getBoundingClientRect().bottom -
                inspector.getBoundingClientRect().bottom -
                parseFloat(getComputedStyle(main).paddingBottom),
            );
          }),
        ).toBeLessThan(1);
      }
      // Include allocation, working/committed labels, tree growth and both detail sizes.
      for (const index of [0, two, seven, steps.length - 1, seven, two]) {
        await page.locator(".event-row").nth(index).click();
        await expect(page.locator(".technical-details dt")).toHaveCount(
          Object.keys(steps[index].details).length,
        );
        expect(await geometry(page)).toEqual(baseline);
      }
      await page.getByRole("button", { name: /Algorithm/ }).click();
      expect(await geometry(page)).toEqual(baseline);
      await accessible(page, page.locator(".algorithm-list > a"));
      await page.getByRole("button", { name: /Events/ }).click();
      await page.locator(".event-row").nth(seven).click();
      await accessible(
        page,
        page.locator(".technical-details dl > div").last(),
      );
      expect(await geometry(page)).toEqual(baseline);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(page.viewportSize()!.width);
  });
}

test("sidebar reclaims width and scrolls independently without resetting playback or zoom", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Phones retain the compact collection/scenario strip.");
  await page.setViewportSize({ width: 1440, height: 900 });
  let writes = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") writes++;
  });
  await page.goto("/");
  await tree(page);
  await page.getByRole("button", { name: "Масштаб 100%", exact: true }).click();
  await page.locator(".event-row").nth(20).click();
  const position = await page.getByTestId("step-number").innerText();
  const history = await page.getByLabel("История операций").inputValue();
  const before = (await page.locator(".canvas-column").boundingBox())!.width;
  const originalWrites = writes;
  const list = page.getByRole("region", {
    name: "Готовые сценарии",
    exact: true,
  });
  await page.evaluate(() => scrollTo(0, 100));
  const outerY = await page.evaluate(() => scrollY);
  const rect = (await list.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.wheel(0, 10000);
  await expect
    .poll(() => list.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(outerY);
  await list.focus();
  await page.keyboard.press("End");
  await accessible(page, page.locator(".scenario-button").last());
  await expect(page.locator(".sidebar-title")).toBeInViewport({ ratio: 1 });
  await expect(page.locator(".sidebar-bottom")).toBeInViewport({ ratio: 1 });
  const collapse = page.getByRole("button", {
    name: "Свернуть боковую панель",
    exact: true,
  });
  await collapse.focus();
  await page.keyboard.press("Enter");
  const expand = page.getByRole("button", {
    name: "Развернуть боковую панель",
    exact: true,
  });
  await expect(expand).toBeFocused();
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Коллекция", { exact: true })).toBeHidden();
  expect(
    (await page.locator(".canvas-column").boundingBox())!.width,
  ).toBeGreaterThan(before + 150);
  await expect
    .poll(async () => {
      const player = (await page.locator(".playback").boundingBox())!;
      const canvas = (await page.locator(".canvas-column").boundingBox())!;
      return Math.abs(player.x + player.width / 2 - canvas.x - canvas.width / 2);
    })
    .toBeLessThan(1);
  await expect(page.getByTestId("step-number")).toHaveText(position);
  await expect(page.getByLabel("История операций")).toHaveValue(history);
  await expect(page.locator(".zoom-controls > span")).toHaveText("100%");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Коллекция", { exact: true })).not.toBeFocused();
  await page.getByLabel("Скорость воспроизведения").selectOption("0.5");
  await page
    .getByRole("button", { name: "Воспроизвести", exact: true })
    .click();
  await expand.click();
  await expect(
    page.getByRole("button", { name: "Пауза", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => Number(await page.getByTestId("step-number").innerText()))
    .toBeGreaterThan(Number(position));
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  expect(writes).toBe(originalWrites);
  await page.setViewportSize({ width: 1100, height: 360 });
  await expect(page.locator(".sidebar-bottom")).toBeInViewport({ ratio: 1 });
  await page.locator(".scenario-button").last().focus();
  await accessible(page, page.locator(".scenario-button").last());
  // At extreme browser-zoom/short-window heights, flow is preferable to clipping pinned regions.
  await page.setViewportSize({ width: 1100, height: 240 });
  await expect(page.locator(".sidebar")).toHaveCSS("position", "static");
  await accessible(page, page.locator(".sidebar-bottom"));
  await accessible(page, page.locator(".scenario-button").last());
});

test("inspector splitter supports pointer, keyboard and touch without changing document height", async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize(
    isMobile ? { width: 320, height: 740 } : { width: 1440, height: 480 },
  );
  await page.goto("/");
  const steps = await tree(page);
  const seven = steps.findIndex((s) => Object.keys(s.details).length === 7);
  await page.locator(".event-row").nth(seven).click();
  const splitter = page.getByRole("separator", {
    name: "Размер областей событий и технических деталей",
  });
  const baseline = await geometry(page);
  await accessible(page, splitter);
  const initial = (await page.locator(".technical-details").boundingBox())!
    .height;
  const handle = (await splitter.boundingBox())!;
  if (isMobile) {
    // Chromium's touch input exercises real pointer capture, rather than synthetic DOM events.
    const client = await page.context().newCDPSession(page);
    const point = {
      x: handle.x + handle.width / 2,
      y: handle.y + handle.height / 2,
    };
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...point, y: point.y - 70 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await client.detach();
  } else {
    await page.mouse.move(
      handle.x + handle.width / 2,
      handle.y + handle.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      handle.x + handle.width / 2,
      handle.y + handle.height / 2 - 70,
      { steps: 5 },
    );
    await page.mouse.up();
  }
  expect(
    (await page.locator(".technical-details").boundingBox())!.height,
  ).toBeGreaterThan(initial + 50);
  expect(await geometry(page)).toEqual(baseline);
  await splitter.focus();
  await page.keyboard.press("End");
  await expect(splitter).toHaveAttribute("aria-valuenow", "85");
  await page.keyboard.press("ArrowUp");
  await expect(splitter).toHaveAttribute("aria-valuenow", "80");
  expect(await geometry(page)).toEqual(baseline);
  const details = page.getByRole("region", {
    name: "Технические детали",
    exact: true,
  });
  await details.focus();
  await page.keyboard.press("End");
  await expect
    .poll(() => details.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  await accessible(page, page.locator(".technical-details dl > div").last());
  await splitter.focus();
  await page.keyboard.press("Home");
  await expect(splitter).toHaveAttribute("aria-valuenow", "15");
  await page.locator(".event-row").last().focus();
  await accessible(page, page.locator(".event-row").last());
  expect(await geometry(page)).toEqual(baseline);
  await page.getByRole("button", { name: /Algorithm/ }).click();
  await expect(splitter).toHaveAttribute("aria-valuenow", "15");
  await accessible(page, page.locator(".algorithm-list > a"));
});

test("ArrayList buffers and selection scroll inside one stable viewport", async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize(
    isMobile ? { width: 412, height: 839 } : { width: 1440, height: 900 },
  );
  await page.goto("/");
  await expect(page.locator(".primary-button")).toBeEnabled();
  await page
    .getByLabel("Коллекция", { exact: true })
    .selectOption("ARRAY_LIST");
  await expect(page.locator(".primary-button")).toBeEnabled();
  const empty = await geometry(page);
  await page.locator(".scenario-button").nth(2).click();
  await expect(page.getByTestId("committed-size")).toHaveText("11");
  expect(await geometry(page)).toEqual(empty);
  for (const expanded of [true, false]) {
    if (!expanded)
      await page
        .getByRole("button", { name: "Свернуть плеер", exact: true })
        .click();
    const baseline = await geometry(page);
    await page
      .locator(".event-row")
      .filter({ hasText: "ARRAY_COPY_COMPLETED" })
      .last()
      .click();
    expect(await geometry(page)).toEqual(baseline);
    const lastCell = page
      .getByRole("region", { name: "Новый буфер", exact: true })
      .getByRole("button")
      .last();
    await lastCell.focus();
    await accessible(page, lastCell);
    if (isMobile) await lastCell.tap();
    else await page.keyboard.press("Enter");
    await accessible(page, page.getByLabel("Сведения о ячейке"));
    expect(await geometry(page)).toEqual(baseline);
    expect(
      await page
        .locator(".array-cells")
        .evaluateAll((lists) =>
          lists.every((el) => el.scrollHeight <= el.clientHeight),
        ),
    ).toBe(true);
    await page.getByRole("button", { name: "В конец", exact: true }).click();
    expect(await geometry(page)).toEqual(baseline);
  }
  // Existing compact navigation stays usable with touch and keyboard; no desktop rail on phones.
  if (isMobile) {
    await expect(page.locator(".sidebar-toggle")).toBeHidden();
    await page.locator(".scenario-button").last().focus();
    await accessible(page, page.locator(".scenario-button").last());
    expect(
      await page.locator(".scenario-list").evaluate((el) => el.scrollLeft),
    ).toBeGreaterThan(0);
    // A vertical gesture starting on the horizontal strip must still scroll the document.
    await page.evaluate(() => scrollTo(0, 0));
    const strip = (await page.locator(".scenario-list").boundingBox())!;
    const point = {
      x: strip.x + strip.width / 2,
      y: strip.y + strip.height / 2,
    };
    const client = await page.context().newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point],
    });
    for (let i = 1; i <= 6; i++) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ ...point, y: point.y - i * 20 }],
      });
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await client.detach();
  }
});

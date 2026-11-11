import { test, expect, type Page } from "./support";
import type { CompactSessionTrace } from "../src/api/trace/hashmap";

async function seek(page: Page, index: number) {
  await page
    .locator(".event-row")
    .nth(index)
    .evaluate((el) => el.click());
  await expect(page.getByTestId("step-number")).toHaveText(String(index + 1));
}

test("resize focus explains occupancy and retains the complete physical graph", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.E2E_PREVIEW === "1",
    "Split preparations remain development-only.",
  );
  await page.goto("/");
  await expect(page.locator(".primary-button")).toBeEnabled();
  let writes = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") writes++;
  });
  for (const low of [6, 2]) {
    const response = page.waitForResponse(
      (r) =>
        r.url().includes("/commands?") &&
        r.request().postDataJSON()?.operation?.key?.value === `F${41 - low}`,
    );
    await page
      .getByRole("button", { name: new RegExp(`Локально: split ${low}/7`) })
      .click();
    const data = (await (await response).json()) as CompactSessionTrace;
    await expect(page.locator(".primary-button")).toBeEnabled();
    const before = writes;
    await seek(page, 9);
    await expect(page.getByLabel("Состояние переноса")).toContainText(
      "Новая таблица: 0/128",
    );
    await expect(page.getByLabel("Состояние переноса")).toContainText(
      "Старая таблица: 31/64",
    );
    await expect(page.getByLabel("Состояние переноса")).toContainText(
      "Map: 49",
    );
    await seek(page, 10);
    const zoom = await page.locator(".zoom-controls > span").textContent();
    await expect(page.locator(".resize-progress")).toContainText(
      `Временные объекты: ${low + 7}`,
    );
    await seek(page, 11);
    await expect(page.locator(".zoom-controls > span")).toHaveText(zoom!);
    await expect(page.getByLabel("Состояние переноса")).toContainText(
      "Старая таблица: 30/64",
    );
    await expect(page.locator("[data-area]")).toHaveCount(3);
    const frame = data.trace.steps[11].snapshot;
    const copies = [...frame.buckets, ...frame.pendingBuckets]
      .flatMap((b) => b.nodeRefs.map((i) => data.nodePool[i]))
      .filter((n) => n.key.value === (low === 6 ? "L3" : "L1"));
    const old = copies.find((n) => !n.linked)!,
      live = copies.find((n) => n.linked)!;
    await expect(page.locator(`[data-entry-id="${live.id}"]`)).toHaveCount(2);
    await page.locator(`[data-object-id="${live.objectId}"]`).focus();
    await page.keyboard.press("Enter");
    await page
      .getByLabel("Физическое представление записи")
      .selectOption(String(old.objectId));
    await page.getByRole("button", { name: "Шаг назад", exact: true }).click();
    await page.getByRole("button", { name: "Шаг вперёд", exact: true }).click();
    await expect(
      page.getByLabel("Физическое представление записи"),
    ).toHaveValue(String(old.objectId));
    await page.getByLabel("Физические связи", { exact: true }).check();
    const edge = page.locator(
      `[data-edge="L-${old.objectId}-${old.left}"] .edge-hit`,
    );
    await edge.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".relationship-info")).toContainText(
      `left → obj ${old.left}`,
    );
    await page.getByRole("button", { name: "К цели", exact: true }).click();
    const node = await page
      .locator(`[data-object-id="${old.left}"]`)
      .boundingBox();
    const viewport = await page.getByTestId("diagram").boundingBox();
    expect(node!.y + node!.height / 2).toBeGreaterThan(viewport!.y);
    expect(node!.y + node!.height / 2).toBeLessThan(
      viewport!.y + viewport!.height,
    );
    await page.getByLabel("Фокус переноса").selectOption("all");
    await expect(page.locator("[data-object-id]")).toHaveCount(
      low === 6 ? 55 : 51,
    );
    await expect(page.locator(`[data-edge^="table-65-root-"]`)).toHaveCount(1);
    await page.getByLabel("Фокус переноса").selectOption("auto");
    await page.getByLabel("Физические связи", { exact: true }).uncheck();
    await page.getByRole("button", { name: "В конец", exact: true }).click();
    await expect(page.getByTestId("metric-size")).toHaveText("49");
    await seek(page, 11);
    await expect(
      page.getByLabel("Физическое представление записи"),
    ).toHaveValue(String(old.objectId));
    expect(writes).toBe(before);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await testInfo.attach(`split-${low}-7.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  }
  await page.getByRole("button", { name: /08 Удаление из дерева/ }).click();
  await expect(page.locator(".primary-button")).toBeEnabled();
  await seek(page, 141);
  expect(await page.getByTestId("diagram").evaluate((el) => el.scrollTop)).toBe(
    0,
  );
});

// Capture geometry between paints: checking only settled frames misses detached edges.
async function sampleStep(page: Page, direction: "forward" | "backward") {
  return page.evaluate(async (direction) => {
    const button = document.querySelector<HTMLButtonElement>(
      `button[aria-label="${direction === "forward" ? "Шаг вперёд" : "Шаг назад"}"]`,
    )!;
    button.click();
    const started = performance.now(),
      transforms = new Map<string, Set<string>>();
    let maxGap = 0;
    await new Promise<void>((resolve) => {
      const tick = () => {
        const nodes = new Map(
          [...document.querySelectorAll<SVGGElement>("[data-object-id]")].map(
            (n) => [n.dataset.objectId!, n],
          ),
        );
        for (const [id, n] of nodes) {
          const values = transforms.get(id) ?? new Set<string>();
          values.add(n.getAttribute("transform") ?? "");
          transforms.set(id, values);
        }
        for (const edge of document.querySelectorAll<SVGGElement>(
          "[data-edge]",
        )) {
          const match = edge.dataset.edge!.match(/^[LR]-(\d+)-(\d+)$/);
          if (!match) continue;
          const from = nodes.get(match[1]),
            to = nodes.get(match[2]),
            path = edge.querySelector("path")!;
          if (!from || !to) continue;
          const source = new DOMPoint(58, 65).matrixTransform(
              from.getScreenCTM()!,
            ),
            target = new DOMPoint(58, 0).matrixTransform(to.getScreenCTM()!);
          const a = path.getPointAtLength(0),
            b = path.getPointAtLength(path.getTotalLength());
          const start = new DOMPoint(a.x, a.y).matrixTransform(
              path.getScreenCTM()!,
            ),
            end = new DOMPoint(b.x, b.y).matrixTransform(path.getScreenCTM()!);
          maxGap = Math.max(
            maxGap,
            Math.hypot(start.x - source.x, start.y - source.y),
            Math.hypot(end.x - target.x, end.y - target.y),
          );
        }
        if (performance.now() - started < 320) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    return {
      maxGap,
      positions: Math.max(...[...transforms.values()].map((v) => v.size)),
    };
  }, direction);
}

test("tree step animations keep links attached and react to reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: /08 Удаление из дерева/ }).click();
  await expect(page.locator(".primary-button")).toBeEnabled();
  await seek(page, 140);
  const forward = await sampleStep(page, "forward");
  expect(forward.maxGap).toBeLessThan(0.5);
  expect(forward.positions).toBeGreaterThan(2);
  const backward = await sampleStep(page, "backward");
  expect(backward.maxGap).toBeLessThan(0.5);
  expect(backward.positions).toBeGreaterThan(2);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await sampleStep(page, "forward");
  expect(reduced.positions).toBe(1);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const restored = await sampleStep(page, "backward");
  expect(restored.positions).toBeGreaterThan(2);
  await page
    .getByRole("button", { name: "Шаг вперёд", exact: true })
    .evaluate((el) => el.click());
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(40);
  const settled = await page
    .locator("[data-object-id]")
    .evaluateAll((ns) => ns.map((n) => n.getAttribute("transform")));
  await page.waitForTimeout(250);
  expect(
    await page
      .locator("[data-object-id]")
      .evaluateAll((ns) => ns.map((n) => n.getAttribute("transform"))),
  ).toEqual(settled);
  await seek(page, 153);
  expect((await sampleStep(page, "forward")).maxGap).toBeLessThan(0.5);
  await page.getByRole("button", { name: "В конец", exact: true }).click();
  await expect(page.locator("[data-object-id]")).toHaveCount(1);
});

test("short and narrow viewports retain a readable canvas with physical details", async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize(
    isMobile ? { width: 320, height: 740 } : { width: 1440, height: 480 },
  );
  await page.goto("/");
  await page.getByRole("button", { name: /08 Удаление из дерева/ }).click();
  await expect(page.locator(".primary-button")).toBeEnabled();
  await seek(page, 141);
  await page.getByLabel("Физические связи", { exact: true }).check();
  expect(
    await page.getByTestId("diagram").evaluate((el) => el.clientHeight),
  ).toBeGreaterThanOrEqual(180);
  const height = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  await seek(page, 165);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    height,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Масштаб 100%", exact: true }).click();
  await page
    .getByRole("button", { name: "Вместить по ширине", exact: true })
    .click();
  expect(
    await page
      .getByTestId("diagram")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
});

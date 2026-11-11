import { test, expectServerSize, expect } from "./support";
import type { CompactSessionTrace } from "../src/api/trace/hashmap";

test("local splits use the standard sidebar, diagram, playback and node inspector", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Выполнить put" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("complementary", { name: "Алгоритм и события" }),
  ).toBeVisible();
  const local = page
    .locator(".sidebar .scenario-button")
    .filter({ hasText: "Локально: split" });
  if (process.env.E2E_PREVIEW === "1") {
    await expect(local).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /К проблемному кадру/ }),
    ).toHaveCount(0);
    await expect(page.locator(".sidebar .scenario-button")).toHaveCount(8);
    // The old URL is also the ordinary app, never a separate production lab.
    await page.goto("/__dev/hashmap-split");
    await expect(
      page.getByRole("button", { name: "Выполнить put" }),
    ).toBeEnabled();
    await expect(local).toHaveCount(0);
    return;
  }
  await expect(local).toHaveCount(2);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let posts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") posts++;
  });
  let firstLogicalId = 0;
  const displayedObject = page
    .locator(".technical-details dl > div")
    .filter({ has: page.locator("dt", { hasText: /^objectId$/ }) })
    .locator("dd");
  for (const low of [6, 2]) {
    const final = page.waitForResponse(
      (r) =>
        r.url().includes("/commands?") &&
        r.request().postDataJSON()?.operation?.key?.value === `F${41 - low}`,
    );
    await page
      .getByRole("button", { name: new RegExp(`Локально: split ${low}/7`) })
      .click();
    const payload = (await (await final).json()) as CompactSessionTrace;
    const frame = payload.trace.steps[11].snapshot;
    const copies = [...frame.buckets, ...frame.pendingBuckets]
      .flatMap((b) => b.nodeRefs.map((i) => payload.nodePool[i]))
      .filter((n) => n.key.value === (low === 6 ? "L3" : "L1"));
    expect(copies).toHaveLength(2);
    const live = copies.find((n) => n.linked)!;
    const old = copies.find((n) => !n.linked)!;
    expect(live.id).toBe(old.id);
    expect(live.objectId).not.toBe(old.objectId);
    if (low === 6) firstLogicalId = live.id;
    await page
      .getByRole("button", { name: "К проблемному кадру 11 (шаг 12)" })
      .click();
    await expect(page.getByTestId("step-number")).toHaveText("12");
    await expect(page.locator(`[data-entry-id="${live.id}"]`)).toHaveCount(2);
    await page.locator(`[data-object-id="${live.objectId}"]`).focus();
    await page.keyboard.press("Enter");
    const selector = page.getByLabel("Физическое представление записи");
    await expect(selector).toHaveValue(String(live.objectId));
    await selector.selectOption(String(old.objectId));
    await expect(displayedObject).toHaveText(String(old.objectId));
    await page
      .getByRole("button", { name: "К выбранному узлу", exact: true })
      .click();
    const obj = await page
      .locator(`[data-object-id="${old.objectId}"]`)
      .boundingBox();
    const viewport = await page.getByTestId("diagram").boundingBox();
    expect(obj!.y + obj!.height / 2).toBeGreaterThan(viewport!.y);
    expect(obj!.y + obj!.height / 2).toBeLessThan(
      viewport!.y + viewport!.height,
    );
    await expect(
      page.locator(
        `[data-edge^="L-${old.objectId}-"], [data-edge^="R-${old.objectId}-"]`,
      ),
    ).toHaveCount(2);
    const writes = posts;
    await page.getByRole("button", { name: "Шаг назад", exact: true }).click();
    await page.getByRole("button", { name: "Шаг вперёд", exact: true }).click();
    await expect(displayedObject).toHaveText(String(old.objectId));
    await page.getByRole("button", { name: "В конец", exact: true }).click();
    await expect(page.getByTestId("metric-size")).toHaveText("49");
    await expect(displayedObject).toHaveText(String(live.objectId));
    await page
      .getByRole("button", { name: "К проблемному кадру 11 (шаг 12)" })
      .click();
    await expect(displayedObject).toHaveText(String(old.objectId));
    expect(posts).toBe(writes);
    await page
      .getByRole("button", { name: "К выбранному узлу", exact: true })
      .click();
    await testInfo.attach(`standard-split-${low}-7.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  }
  const writes = posts;
  await page.getByLabel("История операций").selectOption("0");
  await page
    .getByRole("button", { name: "К проблемному кадру 11 (шаг 12)" })
    .click();
  await expect(page.locator(`[data-entry-id="${firstLogicalId}"]`)).toHaveCount(
    2,
  );
  expect(posts).toBe(writes);
  // Dev preparation must preserve the session's original default RESET constructor.
  await page.getByRole("button", { name: "Начать заново" }).click();
  await expectServerSize(page, 0);
  await page.getByRole("button", { name: "В конец", exact: true }).click();
  await expect(page.getByTestId("metric-capacity")).toHaveText("0");
  await page.getByRole("button", { name: /01 Обычная вставка/ }).click();
  await expect(
    page.getByRole("button", { name: "Выполнить put" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "В конец", exact: true }).click();
  await expect(page.getByTestId("metric-size")).toHaveText("1");
  await expect(
    page.getByRole("button", { name: /К проблемному кадру/ }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a lost local preparation response stops writes and uses normal recovery", async ({
  page,
}) => {
  test.skip(
    process.env.E2E_PREVIEW === "1",
    "Local preparations do not exist in production",
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Выполнить put" }),
  ).toBeEnabled();
  const keys: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/commands?")) {
      const key = r.postDataJSON().operation.key?.value;
      if (key) keys.push(key);
    }
  });
  await page.route(/\/commands\?/, async (route) => {
    if (route.request().postDataJSON().operation.key?.value !== "F0")
      return route.continue();
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    await response.dispose();
    await route.abort("failed");
  });
  await page.getByRole("button", { name: /Локально: split 6\/7/ }).click();
  await expect(page.getByRole("alert")).toContainText("Нет ответа");
  await expect(
    page.getByRole("button", { name: "Выполнить put" }),
  ).toBeEnabled();
  await expectServerSize(page, 14);
  expect(keys).toEqual([
    ...Array.from({ length: 6 }, (_, i) => `L${i}`),
    ...Array.from({ length: 7 }, (_, i) => `H${i}`),
    "F0",
  ]);
  await expect(page.getByLabel("История операций")).toHaveValue("-1");
  await expect(
    page.getByRole("button", { name: /К проблемному кадру/ }),
  ).toHaveCount(0);
});

test("switching collection cancels the remaining local preparation commands", async ({
  page,
}) => {
  test.skip(
    process.env.E2E_PREVIEW === "1",
    "Local preparations do not exist in production",
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Выполнить put" }),
  ).toBeEnabled();
  const keys: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/commands?")) {
      const key = r.postDataJSON().operation.key?.value;
      if (key) keys.push(key);
    }
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let committed!: () => void;
  const committedGate = new Promise<void>((resolve) => {
    committed = resolve;
  });
  await page.route(/\/commands\?/, async (route) => {
    if (route.request().postDataJSON().operation.key?.value !== "F0")
      return route.continue();
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    committed();
    await gate;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: /Локально: split 6\/7/ }).click();
  await committedGate;
  await page
    .getByLabel("Коллекция", { exact: true })
    .selectOption("ARRAY_LIST");
  release();
  await expect(
    page.getByRole("button", { name: "Выполнить add(E)", exact: true }),
  ).toBeEnabled();
  await expectServerSize(page, 0);
  expect(keys.at(-1)).toBe("F0");
  expect(keys).toHaveLength(14);
  await expect(
    page.getByRole("button", { name: /Локально: split/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

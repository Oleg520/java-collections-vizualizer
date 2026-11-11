import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { test, expectServerSize, expect, type Page } from "./support";

async function ready(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Выполнить put" }),
  ).toBeEnabled();
}
async function finish(page: Page) {
  await expect(page.locator(".primary-button")).toBeEnabled();
  await page.getByRole("button", { name: "В конец", exact: true }).click();
}

test("UI and health report the same exact-commit build version", async ({
  page,
  request,
}) => {
  const version = execFileSync("sh", ["../scripts/git-version.sh"], {
    encoding: "utf8",
  }).trim();
  await page.goto("/");
  await expect(page.locator(".version")).toHaveText(version);
  const response = await request.get("/api/v1/health");
  expect(response.ok()).toBeTruthy();
  const health = await response.json();
  const sha = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  expect(health.version).toBe(
    version === "dev" ? `0.0.0-${sha}-SNAPSHOT` : version,
  );
});

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
  await expectServerSize(page, 1);
  await finish(page);
  await expect(page.getByTestId("metric-size")).toHaveText("1");
  await expect(page.getByTestId("metric-capacity")).toHaveText("16");
  await expect(
    page.getByRole("button", { name: /^Узел "Java",.*список/ }),
  ).toBeVisible();
  const number = await page.getByTestId("step-number").textContent();
  await page.getByRole("button", { name: "Шаг назад", exact: true }).click();
  await expect(page.getByTestId("step-number")).not.toHaveText(number!);
  await page.getByRole("button", { name: "Шаг вперёд", exact: true }).click();
  await expect(page.getByTestId("step-number")).toHaveText(number!);
  await page.getByRole("button", { name: "В начало", exact: true }).click();
  await expect(page.getByTestId("metric-capacity")).toHaveText("0");
  await expectServerSize(page, 1);
  await page
    .getByRole("button", { name: "Воспроизвести", exact: true })
    .click();
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  expect(writes).toBe(1);
  await page.getByLabel("Операция", { exact: true }).selectOption("GET");
  await page.getByRole("button", { name: "Выполнить get" }).click();
  await finish(page);
  await expect(page.getByTestId("operation-result")).toHaveText('"Hello"');
  await page.getByLabel("Операция", { exact: true }).selectOption("REMOVE");
  await page.getByRole("button", { name: "Выполнить remove" }).click();
  await expectServerSize(page, 0);
  await finish(page);
  await expect(page.getByTestId("diagram").getByRole("button")).toHaveCount(0);
  await page.getByLabel("Операция", { exact: true }).selectOption("PUT");
  await page.getByLabel("Тип ключа").selectOption("NULL");
  await page.getByLabel("value = null").check();
  await page.getByRole("button", { name: "Выполнить put" }).click();
  await expectServerSize(page, 1);
  await finish(page);
  await expect(
    page.getByRole("button", { name: /^Узел null,.*список/ }),
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
  await expectServerSize(page, 3);
  await finish(page);
  await expect(page.getByTestId("diagram").getByRole("button")).toHaveCount(3);
  await expect(page.locator(".svg-edge-label")).toHaveCount(2);
  await page.getByRole("button", { name: /04 Resize и split/ }).click();
  await expectServerSize(page, 13);
  await finish(page);
  await expect(page.getByTestId("operation-result")).toHaveText(
    "13 записей · готово",
  );
  await expect(page.getByTestId("metric-capacity")).toHaveText("32");
  const split = page
    .locator(".event-row")
    .filter({ hasText: "BUCKET_SPLIT" })
    .first();
  await split.click();
  await expect(page.locator(".split-explanation")).toBeVisible();
  await expect(page.locator(".split-explanation")).toContainText("bucket [1]");
  await page.getByRole("button", { name: /05 Красно-чёрное дерево/ }).click();
  await expectServerSize(page, 9);
  await finish(page);
  await expect(page.getByTestId("metric-capacity")).toHaveText("64");
  await expect(page.getByText("RB TREE", { exact: true })).toBeVisible();
  await expect(page.locator(".svg-edge-label")).toHaveCount(8);
  expect(await page.locator(".red-node").count()).toBeGreaterThan(0);
  expect(await page.locator(".black-node").count()).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Algorithm", exact: true }).click();
  await expect(page.locator(".algorithm-list")).toContainText("h ^ (h >>> 16)");
  if (testInfo.project.name === "mobile")
    await page.getByTitle("Бакет 42: TREE", { exact: true }).click();
  // Let the SVG transitions settle before saving documentation screenshots.
  await page.waitForTimeout(350);
  if (process.env.UPDATE_SCREENSHOTS && testInfo.project.name === "desktop")
    await page.screenshot({ path: "../docs/hashmap-tree.png", fullPage: true });
  if (process.env.UPDATE_SCREENSHOTS && testInfo.project.name === "mobile")
    await page.screenshot({
      path: "../docs/hashmap-mobile.png",
      fullPage: true,
    });
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "В начало", exact: true }).click();
    await finish(page);
  }
  await expectServerSize(page, 9);
  await page.getByRole("button", { name: /06 Почему нет дерева/ }).click();
  await expect(page.getByTestId("operation-result")).toHaveText("—");
  // Wait for this request, since the size is deliberately unchanged.
  await expect(
    page.getByRole("button", { name: /06 Почему нет дерева/ }),
  ).toBeEnabled();
  await finish(page);
  await expect(page.getByTestId("operation-result")).toHaveText(
    "9 записей · готово",
  );
  await expect(page.getByTestId("metric-capacity")).toHaveText("32");
  await expect(page.locator(".red-node,.black-node")).toHaveCount(0);
  await page.getByLabel("История операций").selectOption("0");
  await finish(page);
  await expect(page.getByTestId("metric-size")).toHaveText("3");
  await expectServerSize(page, 9);
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
  await expectServerSize(page, 1);
  const second = await context.newPage();
  await ready(second);
  await expectServerSize(second, 0);
  await second.getByLabel("Тип ключа").selectOption("COLLISION");
  await second.getByRole("textbox", { name: "Ключ", exact: true }).fill("A");
  await second.getByRole("button", { name: "Выполнить put" }).click();
  await expectServerSize(second, 1);
  await second
    .getByRole("textbox", { name: "hashCode", exact: true })
    .fill("43");
  await second.getByRole("button", { name: "Выполнить put" }).click();
  await expect(second.getByRole("alert")).toContainText(
    "hashCode этого ID уже закреплён: 42",
  );
  await expectServerSize(second, 1);
  await second.close();
});

for (const initialCapacity of [0, 16, 32, 64]) {
  test(`all Java demos with initialCapacity=${initialCapacity}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    // Only changes constructor input; all responses come from the real backend.
    await page.route(/\/api\/v1\/sessions(?:\?.*)?$/, (route) =>
      route.continue({ postData: JSON.stringify({ initialCapacity }) }),
    );
    await ready(page);
    const demos = [
      ["insert", "01 Обычная вставка", 1, 16],
      ["collision", "02 Коллизия", 3, 16],
      ["update", "03 Обновление ключа", 1, 16],
      ["resize", "04 Resize и split", 13, 32],
      ["treeify", "05 Красно-чёрное дерево", 9, 64],
      ["why-no-tree", "06 Почему нет дерева", 9, 32],
      ["tree-search", "07 Поиск в дереве", 9, 64],
      ["tree-remove", "08 Удаление из дерева", 1, 64],
    ] as const;
    for (const [id, name, size, capacity] of demos) {
      const responsePromise = page.waitForResponse((r) =>
        r.url().includes(`/scenarios/${id}?`),
      );
      await page
        .getByRole("button", { name: new RegExp(name.replace("?", "\\?")) })
        .click();
      const response = await responsePromise;
      expect(response.ok()).toBe(true);
      expect((await response.json()).encoding).toBe("node-table-v2");
      await expect(
        page.getByRole("button", { name: "Выполнить put" }),
      ).toBeEnabled();
      await finish(page);
      await expect(page.getByTestId("metric-size")).toHaveText(String(size));
      await expect(page.getByTestId("metric-capacity")).toHaveText(
        String(capacity),
      );
    }
    await page.getByRole("button", { name: "Начать заново" }).click();
    await expectServerSize(page, 0);
    await finish(page);
    await expect(page.getByTestId("metric-threshold")).toHaveText(
      String(initialCapacity),
    );
    expect(errors).toEqual([]);
  });
}

test("large tree split, conflict recovery and offline history", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(60000);
  const created = page.waitForResponse(
    (r) =>
      /\/sessions(?:\?.*)?$/.test(r.url()) && r.request().method() === "POST",
  );
  await ready(page);
  const session = await (await created).json();
  let revision = 0;
  for (let i = 0; i < 96; i++) {
    const response = await request.post(
      `/api/v1/sessions/${session.id}/commands?encoding=compact&snapshotVersion=2`,
      {
        data: {
          expectedRevision: revision,
          operation: {
            type: "PUT",
            key: {
              type: "COLLISION",
              value: `K${String(i).padStart(3, "0")}`,
              hashCodeOverride: i % 2 === 0 ? 1 : 129,
            },
            value: "v".repeat(128),
          },
        },
      },
    );
    expect(response.ok()).toBe(true);
    revision = (await response.json()).revision;
    await response.dispose();
  }
  // The browser still owns revision 0: a conflicting command must fetch state without retrying it.
  let writes = 0;
  page.on("request", (r) => {
    if (r.url().includes("/commands") && r.method() === "POST") writes++;
  });
  await page.getByRole("button", { name: "Выполнить put" }).click();
  await expect(page.getByRole("alert")).toContainText("Состояние изменилось");
  await expectServerSize(page, 96);
  expect(writes).toBe(1);
  await page.getByLabel("Тип ключа").selectOption("COLLISION");
  await page.getByRole("textbox", { name: "Ключ", exact: true }).fill("K096");
  await page.getByRole("textbox", { name: "hashCode", exact: true }).fill("1");
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes("/commands") && r.status() === 200,
  );
  await page.getByRole("button", { name: "Выполнить put" }).click();
  const response = await responsePromise;
  const encoded = await response.json();
  expect(encoded.nodePool.length).toBeLessThan(5000);
  expect(encoded.trace.steps.length).toBeGreaterThan(100);
  await expectServerSize(page, 97);
  await finish(page);
  await expect(page.getByTestId("metric-capacity")).toHaveText("256");
  await expect(page.getByText("RB TREE", { exact: true })).toHaveCount(2);
  const zoomLabel = page.locator(".zoom-controls > span");
  const fitZoom = Number.parseInt((await zoomLabel.textContent())!);
  await page
    .getByRole("button", { name: "Уменьшить масштаб", exact: true })
    .click();
  await expect
    .poll(async () => Number.parseInt((await zoomLabel.textContent())!))
    .toBeLessThan(fitZoom);
  const smallerZoom = Number.parseInt((await zoomLabel.textContent())!);
  await page
    .getByRole("button", { name: "Увеличить масштаб", exact: true })
    .click();
  await expect
    .poll(async () => Number.parseInt((await zoomLabel.textContent())!))
    .toBeGreaterThan(smallerZoom);
  await page.getByRole("button", { name: "Масштаб 100%", exact: true }).click();
  expect(
    await page
      .getByTestId("diagram")
      .evaluate((el) => el.scrollWidth > el.clientWidth),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Сбросить масштаб", exact: true })
    .click();
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "В начало", exact: true }).click();
  await expect(page.getByTestId("metric-size")).toHaveText("96");
  await page.getByLabel("Скорость воспроизведения").selectOption("4");
  await page
    .getByRole("button", { name: "Воспроизвести", exact: true })
    .click();
  await expect(page.getByTestId("step-number")).not.toHaveText("1");
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await finish(page);
  await expect(page.getByTestId("metric-size")).toHaveText("97");
  expect(writes).toBe(2);
  await page.context().setOffline(false);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.collectGarbage");
  const heap = await cdp.send("Runtime.getHeapUsage");
  await testInfo.attach("browser-memory.json", {
    body: JSON.stringify(heap, null, 2),
    contentType: "application/json",
  });
  if (process.env.UPDATE_SCREENSHOTS)
    await writeFile(
      `../docs/verification/browser-memory-${testInfo.project.name}.json`,
      JSON.stringify(
        { scenario: "97-entry tree split, compact trace, after GC", ...heap },
        null,
        2,
      ) + "\n",
    );
  expect(heap.usedSize).toBeLessThan(96 * 1024 * 1024);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

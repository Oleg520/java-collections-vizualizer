import { test, expectServerSize, expect, type Page } from "./support";
import type { CompactArrayTrace } from "../src/api/trace/decodeTrace";
import type { Operation } from "../src/api/types/index";
async function ready(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Выполнить put" }),
  ).toBeEnabled();
  await page
    .getByLabel("Коллекция", { exact: true })
    .selectOption("ARRAY_LIST");
  await expect(
    page.getByRole("button", { name: "Выполнить add(E)", exact: true }),
  ).toBeEnabled();
}
async function finish(page: Page) {
  await expect(page.locator(".primary-button")).toBeEnabled();
  await page.getByRole("button", { name: "В конец", exact: true }).click();
}
async function command(page: Page, type: string) {
  await page.getByLabel("Операция", { exact: true }).selectOption(type);
  await page.locator(".primary-button").click();
  await finish(page);
}
test("ArrayList commands, typed null, rewind and constructor configuration", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let writes = 0;
  page.on("request", (r) => {
    if (r.url().includes("/commands") && r.method() === "POST") writes++;
  });
  await ready(page);
  await expect(page.getByTestId("metric-capacity")).toHaveText("0");
  await command(page, "ADD");
  await expect(page.getByTestId("metric-capacity")).toHaveText("10");
  await expect(page.getByTestId("operation-result")).toHaveText("true");
  await page.getByLabel("Тип элемента").selectOption("NULL");
  await command(page, "ADD");
  await expect(
    page.getByRole("button", { name: "Ячейка 1: null", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ячейка 2: пусто", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Операция", { exact: true }).selectOption("GET_AT");
  await page.getByLabel("Индекс", { exact: true }).fill("1");
  await command(page, "GET_AT");
  await expect(page.getByTestId("operation-result")).toHaveText("null");
  await page.getByLabel("Операция", { exact: true }).selectOption("SET_AT");
  await page.getByLabel("Тип элемента").selectOption("INTEGER");
  await page.getByLabel("Элемент", { exact: true }).fill("42");
  await command(page, "SET_AT");
  await command(page, "INDEX_OF");
  await expect(page.getByTestId("operation-result")).toHaveText("1");
  await page.getByLabel("Операция", { exact: true }).selectOption("ADD_AT");
  await page.getByLabel("Индекс", { exact: true }).fill("0");
  await command(page, "ADD_AT");
  await page
    .locator(".event-row")
    .filter({ hasText: "ELEMENTS_SHIFTED_RIGHT" })
    .click();
  await expect(page.locator(".array-cell.highlighted").first()).toBeVisible();
  await command(page, "REMOVE_AT");
  await expect(
    page.locator(".event-row").filter({ hasText: "TAIL_CLEARED" }),
  ).toBeAttached();
  const priorWrites = writes;
  await page.getByRole("button", { name: "В начало", exact: true }).click();
  await page.getByRole("button", { name: "Шаг вперёд", exact: true }).click();
  await page.getByRole("button", { name: "Шаг назад", exact: true }).click();
  await page.getByLabel("Скорость воспроизведения").selectOption("4");
  await page
    .getByRole("button", { name: "Воспроизвести", exact: true })
    .click();
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page.getByLabel("История операций").selectOption("0");
  await finish(page);
  expect(writes).toBe(priorWrites);
  await expectServerSize(page, 2);
  // Capacity operations execute against committed state even when viewing old history.
  await command(page, "ENSURE_CAPACITY");
  await expect(page.getByTestId("metric-capacity")).toHaveText("20");
  await command(page, "TRIM_TO_SIZE");
  await expect(page.getByTestId("metric-capacity")).toHaveText("2");
  await command(page, "CLEAR");
  await expect(page.getByTestId("metric-capacity")).toHaveText("2");
  await command(page, "TRIM_TO_SIZE");
  await expect(page.getByTestId("metric-capacity")).toHaveText("0");
  await command(page, "ADD");
  await expect(page.getByTestId("metric-capacity")).toHaveText("1");
  await page.getByLabel("Конструктор ArrayList").selectOption("0");
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await command(page, "ADD");
  await expect(page.getByTestId("metric-capacity")).toHaveText("1");
  await page.getByLabel("Конструктор ArrayList").selectOption("default");
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await command(page, "ADD");
  await expect(page.getByTestId("metric-capacity")).toHaveText("10");
  expect(errors).toEqual([]);
});
test("all nine Java scenarios, growth buffers, 320px and reduced motion; HashMap still treeifies", async ({
  page,
}, info) => {
  await ready(page);
  for (const [id, size, capacity] of [
    ["first-add", 1, 10],
    ["explicit-zero", 1, 1],
    ["growth", 11, 15],
    ["insert-middle", 4, 10],
    ["remove-middle", 2, 10],
    ["read-replace", 3, 10],
    ["nulls", 2, 10],
    ["capacity", 1, 1],
    ["linear-search", 4, 10],
  ] as const) {
    const response = page.waitForResponse((r) =>
      r.url().includes(`/scenarios/${id}?`),
    );
    const index = [
      "first-add",
      "explicit-zero",
      "growth",
      "insert-middle",
      "remove-middle",
      "read-replace",
      "nulls",
      "capacity",
      "linear-search",
    ].indexOf(id);
    await page.locator(".scenario-button").nth(index).click();
    const encoded: CompactArrayTrace = await (await response).json();
    expect(encoded.encoding).toBe("array-frames-v1");
    await finish(page);
    await expect(page.getByTestId("metric-size")).toHaveText(String(size));
    await expect(page.getByTestId("metric-capacity")).toHaveText(
      String(capacity),
    );
    const labels: Partial<Record<string, [Operation["type"], string][]>> = {
      "read-replace": [["GET_AT", "get(1)"]],
      "remove-middle": [["REMOVE_AT", "remove(1)"]],
      capacity: [
        ["ENSURE_CAPACITY", "ensureCapacity(10)"],
        ["TRIM_TO_SIZE", "trimToSize()"],
        ["CLEAR", "clear()"],
      ],
      nulls: [["SET_AT", "set(2, null)"]],
    };
    for (const [type, label] of labels[id] ?? []) {
      const step = encoded.trace.steps.find(
        (s) => s.event === "OPERATION_STARTED" && s.operation.type === type,
      )!;
      if (type === "SET_AT")
        expect(step.operation.element).toEqual({ type: "NULL", value: null });
      else expect(step.operation.element).toBeNull();
      await page.locator(".event-row").nth(step.index).click();
      await expect(page.locator(".step-op")).toHaveText(label);
      await expect(page.locator(".step-explanation code")).toContainText(
        `OPERATION_STARTED · ${label}`,
      );
      await expect(page.locator(".step-explanation code")).toContainText(
        "Промежуточный снимок",
      );
    }
    if (id === "growth") {
      await page
        .locator(".event-row")
        .filter({ hasText: "ARRAY_COPY_COMPLETED" })
        .last()
        .click();
      await expect(
        page.getByRole("region", { name: "Старый elementData" }),
      ).toContainText("Object[10]");
      await expect(
        page.getByRole("region", { name: "Новый буфер" }),
      ).toContainText("Object[15]");
      if (process.env.UPDATE_SCREENSHOTS)
        await page.screenshot({
          path: `../docs/arraylist-${info.project.name}.png`,
          fullPage: true,
        });
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole("button", { name: "В начало", exact: true }).click();
  await finish(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: 'Ячейка 0: "A"', exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Сведения о ячейке")).toContainText("индекс 0");
  await page.getByLabel("Коллекция", { exact: true }).selectOption("HASH_MAP");
  await expect(
    page.getByRole("button", { name: "Выполнить put" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /05 Красно-чёрное дерево/ }).click();
  await finish(page);
  await expect(page.getByTestId("metric-size")).toHaveText("9");
  await expect(page.getByText("КЧ-ДЕРЕВО", { exact: true })).toBeVisible();
});
test("lost ArrayList response and revision conflict recover without retry; old response cannot replace switched collection", async ({
  page,
  request,
}) => {
  await ready(page);
  let writes = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/commands")) writes++;
  });
  await page.route(
    /\/commands\?encoding=compact(?:&.*)?$/,
    async (route) => {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      await response.dispose();
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page.locator(".primary-button").click();
  await expect(page.getByRole("alert")).toContainText("Нет ответа");
  await expectServerSize(page, 1);
  expect(writes).toBe(1);
  await expect(page.locator(".primary-button")).toBeEnabled();
  let sessionId = "";
  await page.route(
    /\/commands\?encoding=compact(?:&.*)?$/,
    async (route) => {
      const url = route.request().url();
      sessionId = url.split("/sessions/")[1].split("/")[0];
      const direct = await request.post(url, {
        data: {
          expectedRevision: route.request().postDataJSON().expectedRevision,
          operation: {
            type: "ADD",
            element: { type: "STRING", value: "external" },
          },
        },
      });
      expect(direct.ok()).toBe(true);
      await route.continue();
    },
    { times: 1 },
  );
  await page.locator(".primary-button").click();
  await expect(page.getByRole("alert")).toContainText("Состояние изменилось");
  await expectServerSize(page, 2);
  expect(writes).toBe(2);
  await expect(page.locator(".primary-button")).toBeEnabled();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let committed!: () => void;
  const committedGate = new Promise<void>((resolve) => {
    committed = resolve;
  });
  await page.route(
    /\/commands\?encoding=compact(?:&.*)?$/,
    async (route) => {
      const response = await route.fetch();
      committed();
      await gate;
      await route.fulfill({ response });
    },
    { times: 1 },
  );
  await page.locator(".primary-button").click();
  await committedGate;
  await page.getByLabel("Коллекция", { exact: true }).selectOption("HASH_MAP");
  await expect(page.locator(".primary-button")).toBeDisabled();
  release();
  await expect(
    page.getByRole("button", { name: "Выполнить put" }),
  ).toBeEnabled();
  await expectServerSize(page, 0);
  await page.getByRole("button", { name: "Выполнить put" }).click();
  await finish(page);
  await expect(page.getByTestId("metric-capacity")).toHaveText("16");
  expect(
    (
      await (
        await request.get(`/api/v1/sessions/${sessionId}?snapshotVersion=2`)
      ).json()
    ).state.size,
  ).toBe(1);
});

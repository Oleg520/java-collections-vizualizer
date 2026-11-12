import { test, expect, expectServerSize } from "./support";
import type { CompactArrayTrace } from "../src/api/trace/arraylist";

test("physical slots survive writes, block shifts, clears, backward seek and buffer promotion", async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize(
    isMobile ? { width: 320, height: 740 } : { width: 1440, height: 720 },
  );
  await page.goto("/");
  await expect(page.locator(".primary-button")).toBeEnabled();
  await page
    .getByLabel("Коллекция", { exact: true })
    .selectOption("ARRAY_LIST");
  await expect(page.locator(".primary-button")).toBeEnabled();
  await page.getByLabel("Конструктор ArrayList").selectOption("10");
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await expectServerSize(page, 0);

  async function execute(action: () => Promise<unknown>) {
    const response = page.waitForResponse(
      (r) => r.url().includes("encoding=compact") && r.ok(),
    );
    await action();
    const encoded: CompactArrayTrace = await (await response).json();
    await expect(page.locator(".primary-button")).toBeEnabled();
    await page.getByRole("button", { name: "В конец", exact: true }).click();
    return encoded;
  }
  async function transition(encoded: CompactArrayTrace, event: string) {
    const index = encoded.trace.steps.findLastIndex((s) => s.event === event);
    expect(index).toBeGreaterThan(0);
    await page
      .locator(".event-row")
      .nth(index - 1)
      .evaluate((el) => el.click());
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );
    const frames = [
      encoded.trace.steps[index - 1],
      encoded.trace.steps[index],
    ].map((s) =>
      [s.snapshot.bufferRef, s.snapshot.pendingBufferRef]
        .filter((r): r is number => r !== null)
        .map((r) => {
          const b = encoded.bufferPool[r];
          return {
            id: String(b.id),
            capacity: b.capacity,
            labels: b.cellRefs.map((r, i) => {
              const e = r === null ? null : encoded.cellPool[r].element;
              return `Ячейка ${i}: ${!e ? "пусто" : e.type === "NULL" ? "null" : e.type === "STRING" ? JSON.stringify(e.value) : e.value}`;
            }),
          };
        }),
    );
    const sampled = page.evaluate(
      async ({ index, frames }) => {
        const before = new Map(
          [
            ...document.querySelectorAll<HTMLElement>("[data-buffer-id]"),
          ].flatMap((b) =>
            [...b.querySelectorAll<HTMLElement>(".array-cell")].map(
              (c, i) => [`${b.dataset.bufferId}:${i}`, c] as const,
            ),
          ),
        );
        const height = document
          .querySelector(".array-diagram")!
          .getBoundingClientRect().height;
        const errors: string[] = [];
        let samples = 0;
        const started = performance.now();
        while (performance.now() - started < 330) {
          await new Promise(requestAnimationFrame);
          const current =
            Number(
              document.querySelector('[data-testid="step-number"]')!
                .textContent,
            ) - 1;
          const expected = frames[current === index ? 1 : 0];
          const buffers = [
            ...document.querySelectorAll<HTMLElement>("[data-buffer-id]"),
          ];
          if (buffers.length !== expected.length) errors.push("buffer count");
          for (const b of buffers) {
            const target = expected.find((e) => e.id === b.dataset.bufferId);
            const cells = [...b.querySelectorAll<HTMLElement>(".array-cell")];
            if (cells.length !== target?.capacity) errors.push("slot count");
            cells.forEach((c, i) => {
              if (c.getAttribute("aria-label") !== target?.labels[i])
                errors.push("Java contents");
              if (Math.abs(c.getBoundingClientRect().height - 96) > 0.01)
                errors.push("cell height");
              const old = before.get(`${b.dataset.bufferId}:${i}`);
              if (old && old !== c) errors.push("remounted physical slot");
            });
          }
          if (
            document.querySelector(".array-diagram")!.getBoundingClientRect()
              .height !== height
          )
            errors.push("pane height");
          samples++;
        }
        return { errors, samples };
      },
      { index, frames },
    );
    await page
      .locator(".event-row")
      .nth(index)
      .evaluate((el) => el.click());
    const result = await sampled;
    expect(result.samples).toBeGreaterThan(1);
    expect(result.errors).toEqual([]);
  }

  const add = await execute(() => page.locator(".primary-button").click());
  await transition(add, "ELEMENT_WRITTEN");
  const insert = await execute(() =>
    page.locator(".scenario-button").nth(3).click(),
  );
  await transition(insert, "ELEMENTS_SHIFTED_RIGHT");
  await transition(insert, "ELEMENT_WRITTEN");
  await page.getByLabel("Операция", { exact: true }).selectOption("REMOVE_AT");
  const remove = await execute(() => page.locator(".primary-button").click());
  await transition(remove, "ELEMENTS_SHIFTED_LEFT");
  await transition(remove, "TAIL_CLEARED");
  const growth = await execute(() =>
    page.locator(".scenario-button").nth(2).click(),
  );
  await transition(growth, "ARRAY_COPY_COMPLETED");
  const copy = growth.trace.steps.findLastIndex(
    (s) => s.event === "ARRAY_COPY_COMPLETED",
  );
  const destination = page
    .getByRole("region", { name: "Новый буфер", exact: true })
    .getByRole("button")
    .first();
  await destination.focus();
  await page.keyboard.press("Enter");
  await page
    .locator(".event-row")
    .nth(copy + 1)
    .evaluate((el) => el.click());
  await expect(destination).toHaveCount(0); // The region title changed, while its focused slot survived.
  await expect(page.locator(".array-cell").first()).toBeFocused();
  await expect(page.getByLabel("Сведения о ячейке")).toContainText("индекс 0");
  await transition(growth, "CAPACITY_GROWN");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .locator(".event-row")
    .nth(copy)
    .evaluate((el) => el.click());
  await expect(page.locator(".array-cell-content").first()).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("operation and scenario results appear only at the selected trace's final frame", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".primary-button")).toBeEnabled();
  for (const collection of ["HASH_MAP", "ARRAY_LIST"]) {
    await page
      .getByLabel("Коллекция", { exact: true })
      .selectOption(collection);
    await expect(page.locator(".primary-button")).toBeEnabled();
    await expect(page.getByTestId("operation-result")).toHaveText("—");
    await expect(page.locator(".metrics [role=status]")).toHaveCount(0);
    for (const scenario of [false, true]) {
      const response = page.waitForResponse(
        (r) => r.url().includes("encoding=compact") && r.ok(),
      );
      if (scenario)
        await page
          .locator(".scenario-button")
          .nth(collection === "ARRAY_LIST" ? 2 : 4)
          .click();
      else await page.locator(".primary-button").click();
      const data = await (await response).json();
      await expect(page.locator(".primary-button")).toBeEnabled();
      await page.getByRole("button", { name: "В начало", exact: true }).click();
      await expect(page.getByTestId("operation-result")).toHaveText("—");
      if (scenario) {
        const early = data.trace.steps.findIndex(
          (s: { event: string }) => s.event === "OPERATION_COMPLETED",
        );
        await page.locator(".event-row").nth(early).click();
        await expect(page.getByTestId("operation-result")).toHaveText("—");
      }
      await page.getByRole("button", { name: "В конец", exact: true }).click();
      const result = await page.getByTestId("operation-result").textContent();
      expect(result).not.toBe("—");
      await page
        .getByRole("button", { name: "Шаг назад", exact: true })
        .click();
      await expect(page.getByTestId("operation-result")).toHaveText("—");
      await page.getByRole("button", { name: "В конец", exact: true }).click();
      await expect(page.getByTestId("operation-result")).toHaveText(result!);
      await page
        .getByRole("button", { name: "Воспроизвести", exact: true })
        .click();
      await expect(page.getByTestId("operation-result")).toHaveText("—");
      await page.getByRole("button", { name: "Пауза", exact: true }).click();
    }
  }
});

test("4x playback and interrupted backward seeks never add physical grid slots", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".primary-button")).toBeEnabled();
  await page
    .getByLabel("Коллекция", { exact: true })
    .selectOption("ARRAY_LIST");
  await expect(page.locator(".primary-button")).toBeEnabled();
  const response = page.waitForResponse(
    (r) => r.url().includes("/scenarios/growth?") && r.ok(),
  );
  await page.locator(".scenario-button").nth(2).click();
  const encoded: CompactArrayTrace = await (await response).json();
  await expect(page.locator(".primary-button")).toBeEnabled();
  const copy = encoded.trace.steps.findLastIndex(
    (s) => s.event === "ARRAY_COPY_COMPLETED",
  );
  await page
    .locator(".event-row")
    .nth(copy - 2)
    .evaluate((el) => el.click());
  await page.getByLabel("Скорость воспроизведения").selectOption("4");
  const expected = encoded.trace.steps.map((s) =>
    [s.snapshot.bufferRef, s.snapshot.pendingBufferRef]
      .filter((r): r is number => r !== null)
      .map((r) => encoded.bufferPool[r].capacity),
  );
  const sampled = page.evaluate(async (frames) => {
    const failures: string[] = [];
    const start = performance.now();
    while (performance.now() - start < 2000) {
      await new Promise(requestAnimationFrame);
      const cursor =
        Number(
          document.querySelector('[data-testid="step-number"]')!.textContent,
        ) - 1;
      const counts = [...document.querySelectorAll("[data-buffer-id]")].map(
        (b) => b.querySelectorAll(".array-cell").length,
      );
      if (JSON.stringify(counts) !== JSON.stringify(frames[cursor]))
        failures.push(`cursor ${cursor}: ${counts}`);
    }
    return failures;
  }, expected);
  await page
    .getByRole("button", { name: "Воспроизвести", exact: true })
    .evaluate((el) => el.click());
  await page.waitForTimeout(330);
  for (const index of [copy, copy - 1, copy + 1, copy, copy - 1, copy + 1]) {
    await page
      .locator(".event-row")
      .nth(index)
      .evaluate((el) => el.click());
    await page.waitForTimeout(40);
  }
  expect(await sampled).toEqual([]);
  await expectServerSize(page, 11);
});

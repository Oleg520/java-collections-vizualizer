import { test, expect } from "@playwright/test";

test("local split laboratory preserves physical links, selection and history", async ({
  page,
}, testInfo) => {
  await page.goto("/__dev/hashmap-split");
  if (process.env.E2E_PREVIEW === "1") {
    await expect(
      page.getByRole("button", { name: "Загрузить split 6/7" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Выполнить put" }),
    ).toBeEnabled();
    return;
  }
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  let posts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") posts++;
  });
  for (const low of [6, 2]) {
    await page
      .getByRole("button", { name: `Загрузить split ${low}/7` })
      .click();
    await expect(page.getByRole("status")).toContainText(`Split ${low}/7`, {
      timeout: 30000,
    });
    await page.getByRole("button", { name: "Кадр 11 (шаг 12)" }).click();
    await expect(page.getByTestId("step-number")).toHaveText("12");
    const entry = low === 6 ? "4" : "2";
    const copies = page.locator(`[data-entry-id="${entry}"]`);
    await expect(copies).toHaveCount(2);
    const physical = await copies.evaluateAll((ns) =>
      ns.map((n) => n.getAttribute("data-object-id")),
    );
    expect(new Set(physical).size).toBe(2);
    const old = page.locator(`[data-entry-id="${entry}"][data-linked="false"]`);
    const oldId = await old.getAttribute("data-object-id");
    await old.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Выбранный физический объект")).toContainText(
      oldId!,
    );
    const edges = page.locator(
      `[data-edge^="L-${oldId}-"], [data-edge^="R-${oldId}-"]`,
    );
    await expect(edges).toHaveCount(2);
    const liveId = await page
      .locator(`[data-entry-id="${entry}"][data-linked="true"]`)
      .getAttribute("data-object-id");
    const writes = posts;
    await page.getByRole("button", { name: "Шаг назад", exact: true }).click();
    await page.getByRole("button", { name: "Шаг вперёд", exact: true }).click();
    await expect(copies).toHaveCount(2);
    await page.getByRole("button", { name: "В конец", exact: true }).click();
    await expect(copies).toHaveCount(1);
    // Selection falls back to the live physical object, while preferred ID survives rewind.
    await expect(page.getByLabel("Выбранный физический объект")).toContainText(
      liveId!,
    );
    await page.getByRole("button", { name: "Кадр 11 (шаг 12)" }).click();
    await expect(page.getByLabel("Выбранный физический объект")).toContainText(
      oldId!,
    );
    expect(posts).toBe(writes);
    await testInfo.attach(`split-${low}-7.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  }
  const writes = posts;
  await page.getByLabel("История операций").selectOption("0");
  await page.getByRole("button", { name: "Кадр 11 (шаг 12)" }).click();
  await expect(page.locator('[data-entry-id="4"]')).toHaveCount(2);
  await page.getByRole("button", { name: "Прочитать сервер (GET)" }).click();
  await expect(page.getByRole("status")).toContainText("size=49");
  await expect(page.getByLabel("История операций")).toHaveValue("-1");
  expect(posts).toBe(writes);
  expect(errors).toEqual([]);
});

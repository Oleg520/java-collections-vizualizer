import { test, expectServerSize, expect } from "./support";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`large tree navigation with ${reducedMotion} motion`, async ({
    page,
    isMobile,
  }) => {
    await page.emulateMedia({ reducedMotion });
    if (isMobile && reducedMotion === "reduce")
      await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/");
    await page.getByRole("button", { name: /05 Красно-чёрное дерево/ }).click();
    await expectServerSize(page, 9);
    await page.getByRole("button", { name: "В конец", exact: true }).click();
    const diagram = page.getByTestId("diagram");
    const zoom = page.locator(".zoom-controls > span");
    await expect(diagram.getByRole("button")).toHaveCount(9);
    if (isMobile) {
      await expect(zoom).toHaveText("100%");
      expect(
        await diagram.evaluate((el) => el.scrollWidth > el.clientWidth),
      ).toBe(true);
      // Labels retain their natural readable size rather than fitting nine nodes to a phone.
      expect(
        (await diagram.locator(".svg-key").first().boundingBox())!.height,
      ).toBeGreaterThanOrEqual(10);
    } else {
      await expect
        .poll(() =>
          diagram.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        )
        .toBe(true);
    }
    await page
      .getByRole("button", { name: "Вместить по ширине", exact: true })
      .click();
    await expect
      .poll(() =>
        diagram.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      )
      .toBe(true);
    await page
      .getByRole("button", { name: "Масштаб 100%", exact: true })
      .click();
    await expect(zoom).toHaveText("100%");
    await page
      .getByRole("button", { name: "Уменьшить масштаб", exact: true })
      .click();
    await expect(zoom).toHaveText("85%");
    await page
      .getByRole("button", { name: "Увеличить масштаб", exact: true })
      .click();
    await expect(zoom).toHaveText("100%");
    await diagram.evaluate((el) => {
      el.scrollLeft = 0;
    });
    await page.getByTitle("Бакет 42: TREE", { exact: true }).click();
    if (isMobile)
      expect(await diagram.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    // Choosing a node remains possible in an overflowing diagram.
    const node = diagram.getByRole("button").first();
    await node.click();
    await diagram.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
      el.scrollTop = el.scrollHeight;
    });
    await page
      .getByRole("button", { name: "К выбранному узлу", exact: true })
      .click();
    await diagram.scrollIntoViewIfNeeded();
    await expect(node.locator("rect")).toBeInViewport({ ratio: 1 });
    await page
      .getByRole("button", { name: "Сбросить масштаб", exact: true })
      .click();
    if (isMobile) await expect(zoom).toHaveText("100%");
    else
      await expect
        .poll(() =>
          diagram.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        )
        .toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

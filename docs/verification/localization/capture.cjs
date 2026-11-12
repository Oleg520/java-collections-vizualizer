const { chromium } = require(
  process.cwd() + "/frontend/node_modules/playwright",
);
const fs = require("fs");
(async () => {
  const browser = await chromium.launch();
  const report = [];
  for (const [device, width, height] of [
    ["desktop", 1440, 900],
    ["mobile", 412, 839],
    ["narrow", 320, 740],
    ["short", 1440, 720],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:5173");
    await page.locator(".primary-button").waitFor({ state: "visible" });
    await page.waitForFunction(
      () =>
        document.querySelector("main")?.getAttribute("aria-busy") === "false",
    );
    for (const [collection, index, event] of [
      ["HASH_MAP", 3, "BUCKET_SPLIT"],
      ["ARRAY_LIST", 2, "ARRAY_COPY_COMPLETED"],
    ]) {
      if (collection === "ARRAY_LIST") {
        await page.locator(".collection-select").selectOption(collection);
        await page.waitForFunction(
          () =>
            document.querySelector("main")?.getAttribute("aria-busy") ===
            "false",
        );
      }
      await page.locator(".scenario-button").nth(index).click();
      await page.waitForFunction(
        () =>
          document.querySelector("main")?.getAttribute("aria-busy") === "false",
      );
      const row = page
        .locator(".event-row code")
        .getByText(event, { exact: true });
      await (collection === "ARRAY_LIST" ? row.last() : row.first()).click();
      for (const locale of ["ru", "en"]) {
        if ((device === "narrow" || device === "short") && locale === "ru")
          continue;
        await page
          .getByRole("button", {
            name: locale === "ru" ? "Русский" : "English",
            exact: true,
          })
          .click();
        await page.locator("html[lang=" + locale + "]").waitFor();
        await page.evaluate(() => window.scrollTo(0, 0));
        const file = `${device}-${collection.toLowerCase()}-${locale}.png`;
        await page.screenshot({
          path: "docs/verification/localization/" + file,
          fullPage: true,
        });
        const layout = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          buttons: [
            ...document.querySelectorAll(".language-switch button"),
          ].map((el) => ({
            text: el.textContent,
            pressed: el.getAttribute("aria-pressed"),
            background: getComputedStyle(el).backgroundColor,
          })),
        }));
        const body = await page.locator("body").innerText();
        report.push({
          device,
          collection,
          locale,
          file,
          layout,
          untranslatedRussian:
            locale === "en"
              ? body.split("\n").filter((x) => /[А-Яа-яЁё]/.test(x))
              : [],
          errors: [...errors],
        });
      }
    }
    await context.close();
  }
  fs.writeFileSync(
    "docs/verification/localization/layout.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      report.map(
        ({
          device,
          collection,
          locale,
          layout,
          untranslatedRussian,
          errors,
        }) => ({
          device,
          collection,
          locale,
          overflow: layout.overflow,
          untranslatedRussian,
          errors,
        }),
      ),
      null,
      2,
    ),
  );
  await browser.close();
})();

import { describe, expect, it } from "vitest";
import { en, ru } from "./catalog";
import { readLocale, saveLocale, translate } from "./locale";
describe("locale preferences", () => {
  it("uses Russian by default, regardless of browser language", () => {
    for (const value of [null, "", "fr", "EN", "ru"])
      expect(readLocale({ getItem: () => value })).toBe("ru");
    expect(readLocale({ getItem: () => "en" })).toBe("en");
  });
  it("works when storage access is denied", () => {
    expect(
      readLocale({
        getItem: () => {
          throw new Error("denied");
        },
      }),
    ).toBe("ru");
    expect(() =>
      saveLocale(
        {
          setItem: () => {
            throw new Error("denied");
          },
        },
        "en",
      ),
    ).not.toThrow();
  });
  it("persists only the selected language", () => {
    const entries = new Map<string, string>();
    saveLocale({ setItem: (k, v) => entries.set(k, v) }, "en");
    expect([...entries]).toEqual([["jcv.locale", "en"]]);
    expect(readLocale({ getItem: (k) => entries.get(k) ?? null })).toBe("en");
  });
  it("has matching nonempty catalogs", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
    for (const key of Object.keys(ru) as (keyof typeof ru)[]) {
      expect(translate("ru", key).trim()).not.toBe("");
      expect(translate("en", key).trim()).not.toBe("");
    }
  });
});

it("interpolates values once, including literal placeholder-shaped user data", () => {
  expect(translate("en", "validation.KEY_LENGTH", { limit: 64 })).toBe(
    "The key must contain at most 64 characters",
  );
  expect(
    translate("en", "hashmap.presentation.previously", {
      0: "Привет {limit} <value>",
    }),
  ).toBe("previously Привет {limit} <value>");
});

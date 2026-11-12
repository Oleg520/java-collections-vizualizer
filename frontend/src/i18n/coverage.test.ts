import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { ru, en, type MessageKey } from "./catalog";
import { translate } from "./locale";
import { errorRu } from "./errorCatalog";
import { scenarioMessages, scenarioText } from "./scenarios";
import { eventExplanation, eventMessages } from "./events";
import type { Step } from "../api/types";
const root = resolve(import.meta.dirname, "../../..");
const source = (name: string) => readFileSync(resolve(root, name), "utf8");
it("has matching nonempty catalogs and identical interpolation parameters", () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
  const placeholders = (value: string) =>
    [...value.matchAll(/\{\w+\}/g)].map((x) => x[0]).sort();
  for (const key of Object.keys(ru) as MessageKey[]) {
    expect(en[key].trim(), key).not.toBe("");
    expect(placeholders(en[key]), key).toEqual(placeholders(ru[key]));
  }
});
it("covers every backend validation reason", () => {
  for (const name of ["hashmap/HashMapEngine", "arraylist/ArrayListEngine"]) {
    for (const match of source(
      `core/src/main/java/dev/collectionsviz/core/collections/${name}.java`,
    ).matchAll(/new InputException\("([A-Z_]+)"/g))
      expect(Object.hasOwn(errorRu, `validation.${match[1]}`), match[1]).toBe(
        true,
      );
  }
});
it("covers the exact Java scenario IDs, without owning order or execution", () => {
  for (const [collection, name] of [
    ["HASH_MAP", "hashmap/HashMapEngine"],
    ["ARRAY_LIST", "arraylist/ArrayListEngine"],
  ] as const) {
    const ids = [
      ...source(
        `core/src/main/java/dev/collectionsviz/core/collections/${name}.java`,
      ).matchAll(/new Scenario\("([^"]+)"/g),
    ].map((x) => x[1]);
    expect(
      Object.keys(scenarioMessages[collection])
        .filter((id) => !id.startsWith("local-"))
        .sort(),
    ).toEqual(ids.sort());
    for (const id of ids)
      for (const locale of ["ru", "en"] as const) {
        const text = scenarioText(locale, collection, id);
        expect(text.title).not.toContain(`: ${id}`);
        expect(text.description.trim()).not.toBe("");
      }
  }
});
it("covers every real Java fixture variant, ignoring the Russian message", () => {
  const fixture = JSON.parse(
    source("backend/src/test/resources/contracts/localization-events.json"),
  ) as Step[];
  const observed = new Set(fixture.map((step) => step.event));
  expect(observed.size).toBeGreaterThan(40);
  for (const step of fixture)
    for (const locale of ["ru", "en"] as const) {
      expect(Object.hasOwn(eventMessages, step.event), step.event).toBe(true);
      const before = JSON.stringify(step);
      const output = eventExplanation(locale, {
        ...step,
        message: "POISON MESSAGE",
      });
      expect(output).toBe(
        eventExplanation(locale, { ...step, message: "Другая фраза" }),
      );
      expect(output).not.toMatch(/POISON|undefined|\{\d+\}/);
      if (locale === "en") expect(output).not.toMatch(/[А-Яа-яЁё]/);
      expect(JSON.stringify(step)).toBe(before);
    }
  for (const variant of Object.keys(eventMessages).filter((key) =>
    key.includes("."),
  )) {
    const [event, detail] = variant.split(".");
    const found = fixture.some(
      (s) =>
        s.event === event &&
        (["TREE_RECOLORED", "UNTREEIFIED"].includes(event)
          ? detail.startsWith("SPLIT_COUNT_")
            ? `${s.details.reason}_${s.details.partition}` === detail
            : s.details.reason === detail
          : ["NODE_INSERTED", "TREE_DIRECTION"].includes(event)
            ? s.details.context === detail
            : event === "TREE_ROTATED"
              ? s.details.direction === detail
              : ["CAPACITY_CHECKED", "TREE_BALANCED"].includes(event)
                ? s.operation.type === detail
                : detail === "found"
                  ? s.details.found === true || s.details.equal === true
                  : false),
    );
    expect(found, `Missing real Java variant ${variant}`).toBe(true);
  }
});
it("uses localized safe fallbacks and grammatical counts", () => {
  expect(translate("en", "not.a.key" as MessageKey)).toBe(
    "Translation unavailable",
  );
  expect(
    eventExplanation("en", {
      event: "constructor",
      operation: { type: "CLEAR" },
      details: {},
    } as Step),
  ).toBe("Java event: constructor");
  for (const [count, text] of [
    [1, "1 запись"],
    [2, "2 записи"],
    [5, "5 записей"],
    [21, "21 запись"],
  ] as const)
    expect(translate("ru", "entryCount", { count })).toBe(text);
  expect(translate("en", "entryCount", { count: 1 })).toBe("1 entry");
  expect(translate("en", "entryCount", { count: 2 })).toBe("2 entries");
});

it("keeps UI JSX copy in catalogs, with an explicit allowlist for Java notation and brand names", async () => {
  const ts = await import("typescript");
  const { readdirSync } = await import("node:fs");
  const allowed = new Set([
    "Visualizer",
    "Collections",
    "GitHub",
    "null",
    "J",
    "new ArrayList&lt;&gt;()",
    "new ArrayList&lt;&gt;(",
    "String",
    "Integer",
    "minCapacity",
    "Object[",
    "· System.arraycopy",
    "elementData → #",
    "size",
    "· capacity",
    "put(K, V)",
    "get(K)",
    "remove(K)",
    "key",
    "hashCode",
    "int",
    "value",
    "value = null",
    "clear",
    "Java 21",
    "Map:",
    "table = null",
    "→ obj",
    "put",
    "· obj",
    "obj",
  ]);
  const attributes = new Set([
    "Java",
    "Hello",
    "hashCode",
    "minCapacity",
    "Java Collections Visualizer",
    "Java Collections Framework",
  ]);
  for (const folder of ["app", "components", "features", "playback"]) {
    const directory = resolve(root, "frontend/src", folder);
    for (const file of readdirSync(directory, { recursive: true })
      .map(String)
      .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))) {
      const path = resolve(directory, file);
      const text = readFileSync(path, "utf8");
      const ast = ts.createSourceFile(
        path,
        text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const visit = (node: import("typescript").Node) => {
        if (ts.isJsxText(node)) {
          const value = node.text.replace(/\s+/g, " ").trim();
          if (/[A-Za-zА-Яа-яЁё]/.test(value))
            expect(allowed.has(value), `${folder}/${file}: ${value}`).toBe(
              true,
            );
        }
        if (
          ts.isJsxAttribute(node) &&
          ["aria-label", "aria-description", "placeholder", "title"].includes(
            node.name.getText(ast),
          ) &&
          node.initializer &&
          ts.isStringLiteral(node.initializer)
        )
          expect(
            attributes.has(node.initializer.text),
            `${file}: ${node.initializer.text}`,
          ).toBe(true);
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
  }
});

import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ArraySnapshot,
  CollectionSnapshot,
  Snapshot,
  Trace,
} from "../api/types";
import { collectionViews, statePresentation } from "./collectionViews";

const map: Snapshot = {
  phase: "COMMITTED",
  size: 2,
  capacity: 16,
  threshold: 12,
  loadFactor: 0.75,
  pendingCapacity: 0,
  buckets: [],
  pendingBuckets: [],
};
const array: ArraySnapshot = {
  collection: "ARRAY_LIST",
  phase: "COMMITTED",
  size: 2,
  capacity: 10,
  emptyMode: "ALLOCATED",
  initialCapacity: null,
  buffer: { id: 7, capacity: 10, cells: [] },
  pendingBuffer: null,
};
function trace(
  collection: string,
  result: Partial<Trace["result"]> = {},
): Trace {
  const snapshot = collection === "ARRAY_LIST" ? array : map;
  return {
    schemaVersion: 1,
    collection,
    operation: { type: "GET", key: null, value: null },
    result: { found: false, previousValue: null, value: null, ...result },
    before: snapshot,
    committed: snapshot,
    steps: [],
  };
}
const metricValues = (snapshot?: CollectionSnapshot) =>
  statePresentation(snapshot).metrics.map(({ label, value }) => [label, value]);
afterEach(() => vi.restoreAllMocks());

describe("registered collection presentation", () => {
  it("preserves the loading placeholders", () => {
    expect(metricValues()).toEqual([
      ["size", "—"],
      ["capacity", "—"],
      ["threshold", "—"],
      ["loadFactor", ".75"],
    ]);
    expect(statePresentation()).toMatchObject({
      result: "Готов к работе",
      resultCaption: "начните с put или сценария",
    });
  });
  it("selects HashMap metrics and found/missing result captions", () => {
    expect(metricValues(map)).toEqual([
      ["size", 2],
      ["capacity", 16],
      ["threshold", 12],
      ["loadFactor", 0.75],
    ]);
    expect(
      statePresentation(
        map,
        trace("HASH_MAP", { found: true, value: "hello" }),
      ),
    ).toMatchObject({
      result: '"hello"',
      resultCaption: "ключ найден в коллекции",
    });
    expect(statePresentation(map, trace("HASH_MAP"))).toMatchObject({
      result: "null · не найден",
      resultCaption: "операция выполнена Java-движком",
    });
  });
  it("selects ArrayList metrics and idle caption", () => {
    expect(metricValues(array)).toEqual([
      ["size", 2],
      ["capacity", 10],
      ["free", 8],
      ["buffer", "#7"],
    ]);
    expect(statePresentation(array).resultCaption).toBe(
      "начните с add или сценария",
    );
  });
  it.each([
    [{ kind: "BOOLEAN", booleanValue: true }, "true"],
    [{ kind: "INT", intValue: -1 }, "-1"],
    [
      { kind: "ELEMENT", element: { type: "STRING", value: "hello" } },
      '"hello"',
    ],
    [{ kind: "ELEMENT", element: { type: "NULL", value: null } }, "null"],
    [{ kind: "VOID" }, "void"],
    [{ kind: "RESET" }, "Новая коллекция"],
  ] satisfies [Partial<Trace["result"]>, string][])(
    "formats ArrayList result %j",
    (result, expected) => {
      expect(
        statePresentation(array, trace("ARRAY_LIST", result)),
      ).toMatchObject({
        result: expected,
        resultCaption: "операция выполнена Java-движком",
      });
    },
  );
  it("dispatches through registered handlers, independently for the snapshot and trace", () => {
    const metrics = [{ label: "registered", value: 42, caption: "test" }];
    const formatMetrics = vi
      .spyOn(collectionViews.ARRAY_LIST, "metrics")
      .mockReturnValue(metrics);
    const formatResult = vi
      .spyOn(collectionViews.HASH_MAP, "resultText")
      .mockReturnValue("registered result");
    const formatCaption = vi
      .spyOn(collectionViews.HASH_MAP, "resultCaption")
      .mockReturnValue("registered caption");
    const operation = trace("HASH_MAP");
    expect(statePresentation(array, operation)).toEqual({
      metrics,
      result: "registered result",
      resultCaption: "registered caption",
    });
    expect(formatMetrics).toHaveBeenCalledWith(array);
    expect(formatResult).toHaveBeenCalledWith(operation);
    expect(formatCaption).toHaveBeenCalledWith(operation);
  });
  it.each(["LINKED_LIST", "constructor", "toString"])(
    "rejects unregistered trace collection %s",
    (collection) => {
      expect(() => statePresentation(map, trace(collection))).toThrow(
        "Неизвестная коллекция trace",
      );
    },
  );
  it("rejects an unsupported snapshot instead of rendering HashMap metrics", () => {
    const unknown = {
      collection: "LINKED_LIST",
      phase: "COMMITTED",
      size: 0,
      capacity: 0,
    } as unknown as CollectionSnapshot;
    expect(() => statePresentation(unknown)).toThrow("Неизвестный тип снимка");
  });
});

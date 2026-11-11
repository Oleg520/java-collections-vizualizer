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
  const operation = { type: "GET" as const, key: null, value: null };
  return {
    schemaVersion: 1,
    collection,
    operation,
    result: { found: false, previousValue: null, value: null, ...result },
    before: snapshot,
    committed: snapshot,
    steps: ["OPERATION_STARTED", "OPERATION_COMPLETED"].map((event, index) => ({
      index,
      operation,
      event,
      stage: "operation",
      message: event,
      details: {},
      snapshot,
    })),
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
      result: "—",
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
        1,
      ),
    ).toMatchObject({
      result: '"hello"',
      resultCaption: "ключ найден в коллекции",
    });
    expect(statePresentation(map, trace("HASH_MAP"), 1)).toMatchObject({
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
    [{ kind: "BOOLEAN", booleanValue: false }, "false"],
    [{ kind: "INT", intValue: 0 }, "0"],
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
        statePresentation(array, trace("ARRAY_LIST", result), 1),
      ).toMatchObject({
        result: expected,
        resultCaption: "операция выполнена Java-движком",
      });
    },
  );
  it.each(["HASH_MAP", "ARRAY_LIST"])(
    "hides the future %s result and caption until its last trace frame",
    (collection) => {
      const view = collectionViews[collection as "HASH_MAP" | "ARRAY_LIST"];
      const formatResult = vi.spyOn(view, "resultText");
      const formatCaption = vi.spyOn(view, "resultCaption");
      const operation = trace(collection, {
        kind: "BOOLEAN",
        booleanValue: true,
      });
      const snapshot = operation.before;
      for (const cursor of [undefined, -1, 0, operation.steps.length]) {
        expect(statePresentation(snapshot, operation, cursor)).toMatchObject({
          result: "—",
          resultCaption: "Результат появится после завершения трассировки.",
        });
      }
      expect(formatResult).not.toHaveBeenCalled();
      expect(formatCaption).not.toHaveBeenCalled();
      expect(statePresentation(snapshot, operation, 1).result).not.toBe("—");
      expect(statePresentation(snapshot, operation, 0).result).toBe("—");
    },
  );
  it("does not reveal a scenario result at an earlier completed operation", () => {
    const scenario = trace("ARRAY_LIST", { kind: "INT", intValue: 42 });
    scenario.operation = { type: "SCENARIO", key: null, value: "test" };
    scenario.steps = [
      ...scenario.steps,
      ...scenario.steps.map((step) => ({ ...step, index: step.index + 2 })),
    ];
    expect(scenario.steps[1].event).toBe("OPERATION_COMPLETED");
    expect(scenario.steps[1].snapshot.phase).toBe("COMMITTED");
    expect(statePresentation(array, scenario, 1).result).toBe("—");
    expect(statePresentation(array, scenario, 3).result).toBe("42");
    expect(statePresentation(array, scenario, 2).result).toBe("—");
    expect(statePresentation(array).result).toBe("—");
  });
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
    expect(
      statePresentation(array, operation, operation.steps.length - 1),
    ).toEqual({
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

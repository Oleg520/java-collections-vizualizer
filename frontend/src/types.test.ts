import { expect, it } from "vitest";
import { operationLabel, type Operation } from "./types";

const operation = (
  type: Operation["type"],
  fields: Partial<Omit<Operation, "type">> = {},
): Operation => ({
  type,
  key: null,
  value: null,
  index: null,
  element: null,
  minCapacity: null,
  ...fields,
});
const labels: [Operation, string][] = [
  [operation("ADD", { element: { type: "INTEGER", value: "10" } }), "add(10)"],
  [operation("ADD", { element: { type: "NULL", value: null } }), "add(null)"],
  [
    operation("ADD", { element: { type: "STRING", value: "null" } }),
    'add("null")',
  ],
  [
    operation("ADD_AT", { index: 0, element: { type: "STRING", value: "X" } }),
    'add(0, "X")',
  ],
  [operation("GET_AT", { index: 0 }), "get(0)"],
  [
    operation("SET_AT", { index: 2, element: { type: "NULL", value: null } }),
    "set(2, null)",
  ],
  [operation("REMOVE_AT", { index: 1 }), "remove(1)"],
  [
    operation("INDEX_OF", { element: { type: "NULL", value: null } }),
    "indexOf(null)",
  ],
  [
    operation("INDEX_OF", { element: { type: "STRING", value: "42" } }),
    'indexOf("42")',
  ],
  [operation("ENSURE_CAPACITY", { minCapacity: 10 }), "ensureCapacity(10)"],
  [operation("ENSURE_CAPACITY", { minCapacity: 0 }), "ensureCapacity(0)"],
  [operation("ENSURE_CAPACITY", { minCapacity: -1 }), "ensureCapacity(-1)"],
  [operation("TRIM_TO_SIZE"), "trimToSize()"],
  [operation("CLEAR"), "clear()"],
  [operation("RESET"), "reset()"],
  [operation("SCENARIO", { value: "growth" }), "demo / growth"],
  [
    operation("PUT", {
      key: { type: "STRING", value: "A", hashCodeOverride: null },
      value: "B",
    }),
    'put("A", "B")',
  ],
  [
    operation("GET", {
      key: { type: "INTEGER", value: "42", hashCodeOverride: null },
    }),
    "get(42)",
  ],
  [
    operation("REMOVE", {
      key: { type: "NULL", value: null, hashCodeOverride: null },
    }),
    "remove(null)",
  ],
];
it.each(labels)("formats %j as %s", (op, label) => {
  expect(operationLabel(op)).toBe(label);
});
it("formats omitted optional fields like explicit JSON null fields", () => {
  expect(operationLabel({ type: "CLEAR", key: null, value: null })).toBe(
    "clear()",
  );
  expect(
    operationLabel({ type: "GET_AT", key: null, value: null, index: 1 }),
  ).toBe("get(1)");
});
it("uses each operation's signature when displaying older traces with extraneous elements", () => {
  for (const [op, label] of labels.filter(([op]) =>
    [
      "GET_AT",
      "REMOVE_AT",
      "CLEAR",
      "RESET",
      "ENSURE_CAPACITY",
      "TRIM_TO_SIZE",
    ].includes(op.type),
  )) {
    expect(
      operationLabel({ ...op, element: { type: "NULL", value: null } }),
    ).toBe(label);
  }
});

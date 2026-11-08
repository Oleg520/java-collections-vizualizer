import { expect, it } from "vitest";
import { decodeTrace, type ArrayFrame, type CompactArrayTrace } from "./trace";
import {
  isArray,
  operationLabel,
  elementLabel,
  type ArraySnapshot,
} from "./types";
const frame = (ref: number): ArrayFrame => ({
  collection: "ARRAY_LIST",
  phase: "WORKING",
  size: 1,
  capacity: 2,
  emptyMode: "ALLOCATED",
  initialCapacity: null,
  bufferRef: ref,
  pendingBufferRef: 1,
});
const input = (): CompactArrayTrace => ({
  schemaVersion: 1,
  sessionId: "list",
  revision: 1,
  encoding: "array-frames-v1",
  cellPool: [
    { id: 1, element: { type: "NULL", value: null } },
    { id: 2, element: { type: "NULL", value: null } },
  ],
  bufferPool: [
    { id: 1, capacity: 2, cellRefs: [0, null] },
    { id: 2, capacity: 3, cellRefs: [0, 1, null] },
  ],
  trace: {
    schemaVersion: 1,
    collection: "ARRAY_LIST",
    operation: {
      type: "ADD",
      key: null,
      value: null,
      element: { type: "NULL", value: null },
    },
    result: {
      found: false,
      previousValue: null,
      value: null,
      kind: "BOOLEAN",
      booleanValue: true,
    },
    before: frame(0),
    committed: {
      ...frame(1),
      phase: "COMMITTED",
      size: 2,
      capacity: 3,
      pendingBufferRef: null,
    },
    steps: [0, 0, 1].map((ref, index) => ({
      index,
      event: "ARRAY_COPY_COMPLETED",
      stage: "capacity",
      message: "copy",
      operation: { type: "ADD", key: null, value: null },
      details: { length: 1 },
      snapshot: frame(ref),
    })),
  },
});
it("decodes immutable buffer versions, duplicate null occurrences and free slots losslessly", () => {
  const source = input(),
    original = JSON.stringify(source),
    result = decodeTrace(source).trace;
  const before = result.before as ArraySnapshot,
    committed = result.committed as ArraySnapshot;
  expect(isArray(before)).toBe(true);
  expect(before.buffer.cells).toEqual([source.cellPool[0], null]);
  expect(committed.buffer.cells).toEqual([...source.cellPool, null]);
  expect(before.buffer.cells[0]).toBe(committed.buffer.cells[0]);
  expect(result.steps[0].snapshot).toEqual(result.steps[1].snapshot);
  expect((result.steps[0].snapshot as ArraySnapshot).buffer).toBe(
    (result.steps[1].snapshot as ArraySnapshot).buffer,
  );
  expect(JSON.stringify(source)).toBe(original);
  expect(elementLabel({ type: "STRING", value: "null" })).toBe('"null"');
  expect(elementLabel({ type: "NULL", value: null })).toBe("null");
});
it("rejects invalid cell and buffer references and inconsistent lengths", () => {
  for (const index of [-1, 0.5, 50]) {
    const source = input();
    source.trace.before.bufferRef = index;
    expect(() => decodeTrace(source)).toThrow("Повреждённая ссылка");
    const cell = input();
    cell.bufferPool[0].cellRefs[0] = index;
    expect(() => decodeTrace(cell)).toThrow("Повреждённая ссылка");
  }
  const source = input();
  source.bufferPool[0].capacity = 5;
  expect(() => decodeTrace(source)).toThrow("Повреждённый буфер");
});

it("labels nullable transport fields without inventing empty arguments", () => {
  expect(
    operationLabel({
      type: "ADD",
      key: null,
      value: null,
      index: null,
      minCapacity: null,
      element: { type: "INTEGER", value: "10" },
    }),
  ).toBe("add(10)");
  expect(
    operationLabel({
      type: "SCENARIO",
      key: null,
      value: "growth",
      index: null,
      minCapacity: null,
      element: null,
    }),
  ).toBe("demo / growth");
});

import type { Snapshot } from "../types/index";
import { describe, expect, it } from "vitest";
import {
  decodeTrace,
  type CompactSessionTrace,
  type Frame,
} from "./decodeTrace";
import type { MapNode } from "../types/index";

const original: MapNode = {
  id: 7,
  objectId: 7,
  key: { type: "STRING", value: "A", hashCodeOverride: null },
  value: "before",
  rawHashCode: 65,
  hash: 65,
  next: null,
  parent: null,
  left: null,
  right: null,
  prev: null,
  red: null,
  linked: true,
};
const frame = (index: number): Frame => ({
  phase: "COMMITTED",
  size: 1,
  capacity: 16,
  threshold: 12,
  loadFactor: 0.75,
  pendingCapacity: 0,
  pendingBuckets: [],
  buckets: [
    { index: 1, kind: "LIST", headId: 7, rootId: null, nodeRefs: [index] },
  ],
});
const response = (): CompactSessionTrace => ({
  schemaVersion: 2,
  sessionId: "session",
  revision: 2,
  encoding: "node-table-v2",
  nodePool: [original, { ...original, value: "after" }],
  trace: {
    schemaVersion: 2,
    collection: "HASH_MAP",
    operation: { type: "PUT", key: original.key, value: "after" },
    result: { found: true, previousValue: "before", value: "after" },
    before: frame(0),
    committed: frame(1),
    steps: [0, 0, 1].map((n, index) => ({
      index,
      operation: { type: "PUT", key: original.key, value: "after" },
      event: "VALUE_UPDATED",
      stage: "mutation",
      message: "value",
      details: {},
      snapshot: frame(n),
    })),
  },
});

describe("compact trace decoding", () => {
  it("shares unchanged versions, preserving separate old and new states", () => {
    const input = response(),
      before = JSON.stringify(input),
      output = decodeTrace(input).trace;
    const nodes = output.steps.map(
      (s) => (s.snapshot as Snapshot).buckets[0].nodes[0],
    );
    expect(nodes[0]).toBe(nodes[1]);
    expect(nodes[0]).not.toBe(nodes[2]);
    expect(nodes.map((n) => n.value)).toEqual(["before", "before", "after"]);
    expect(nodes[0].id).toBe(nodes[2].id);
    expect(JSON.stringify(input)).toBe(before);
    expect(output.committed).toEqual(output.steps[2].snapshot);
  });
  it("rejects broken references and accepts the full format unchanged", () => {
    const full = decodeTrace(response());
    expect(decodeTrace(full)).toBe(full);
    const input = response();
    input.trace.before.buckets[0].nodeRefs = [99];
    expect(() => decodeTrace(input)).toThrow("Повреждённая ссылка");
  });
});

it("preserves simultaneous physical versions of one logical entry and rejects ambiguous addresses", () => {
  const input = response();
  const old = { ...original, objectId: 17, red: false, left: 7, linked: false };
  input.nodePool.push(old);
  input.trace.before.buckets.push({
    index: 2,
    kind: "TREE",
    headId: 17,
    rootId: 17,
    nodeRefs: [2],
  });
  const decoded = decodeTrace(input).trace.before as Snapshot;
  expect(
    decoded.buckets.flatMap((b) => b.nodes).map((n) => [n.id, n.objectId]),
  ).toEqual([
    [7, 7],
    [7, 17],
  ]);
  input.nodePool[2] = { ...old, objectId: 7 };
  expect(() => decodeTrace(input)).toThrow(/objectId/);
});

it("rejects the retired format rather than inventing physical identity", () => {
  const input = { ...response(), encoding: "node-table-v1" };
  expect(() => decodeTrace(input as never)).toThrow("Неизвестный формат");
});

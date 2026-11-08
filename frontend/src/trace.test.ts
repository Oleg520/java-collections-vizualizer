import type { Snapshot } from "./types";
import { describe, expect, it } from "vitest";
import { decodeTrace, type CompactSessionTrace, type Frame } from "./trace";
import type { MapNode } from "./types";

const original: MapNode = {
  id: 7,
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
  schemaVersion: 1,
  sessionId: "session",
  revision: 2,
  encoding: "node-table-v1",
  nodePool: [original, { ...original, value: "after" }],
  trace: {
    schemaVersion: 1,
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

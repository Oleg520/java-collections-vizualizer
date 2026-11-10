import { describe, it, expect } from "vitest";
import type { MapNode, Snapshot } from "../../api/types";
import { layoutSnapshot } from "./layout";
import { resolveSelection } from "./identity";
const node = (
  id: number,
  physical: number,
  extra: Partial<MapNode> = {},
): MapNode => ({
  id,
  objectId: physical,
  key: { type: "COLLISION", value: `K${id}`, hashCodeOverride: 1 },
  value: "v",
  rawHashCode: 1,
  hash: 1,
  next: null,
  parent: null,
  left: null,
  right: null,
  prev: null,
  red: null,
  linked: true,
  ...extra,
});
const live = node(4, 20);
const old = node(4, 4, { red: false, linked: false, left: 2, right: 8 });
const left = node(2, 2, { red: true, parent: 4, linked: false });
const right = node(8, 8, { red: false, parent: 4 });
const snapshot = (ghost = true): Snapshot => ({
  phase: "WORKING",
  size: 3,
  capacity: 128,
  threshold: 96,
  loadFactor: 0.75,
  pendingCapacity: 64,
  buckets: [
    { index: 1, kind: "LIST", headId: 20, rootId: null, nodes: [live] },
    {
      index: 65,
      kind: "TREE",
      headId: 8,
      rootId: ghost ? 4 : 8,
      nodes: [right],
    },
  ],
  pendingBuckets: ghost
    ? [
        {
          index: 1,
          kind: "TRANSFER",
          headId: 4,
          rootId: null,
          nodes: [old, left],
        },
      ]
    : [],
});
describe("physical HashMap identity", () => {
  it("draws both representations and exact cross-area targets without aliasing the logical record", () => {
    const s = snapshot();
    const before = JSON.stringify(s);
    const d = layoutSnapshot(s);
    expect(d.nodes.map((n) => n.node.objectId)).toEqual([20, 8, 4, 2]);
    expect(d.edges.map((e) => [e.from, e.to, e.label])).toEqual([
      [4, 2, "L"],
      [4, 8, "R"],
    ]);
    expect(new Set(d.edges.map((e) => e.id)).size).toBe(d.edges.length);
    expect(JSON.stringify(s)).toBe(before);
  });
  it("keeps exact physical selection, falls back to the live entry and restores preferred identity on rewind", () => {
    const selected = { logicalId: 4, preferredObjectId: 4 };
    expect(resolveSelection(snapshot(), selected)).toBe(old);
    expect(resolveSelection(snapshot(false), selected)).toBe(live);
    expect(resolveSelection(snapshot(), selected)).toBe(old);
    expect(
      resolveSelection({ ...snapshot(false), buckets: [] }, selected),
    ).toBeUndefined();
    expect(selected).toEqual({ logicalId: 4, preferredObjectId: 4 });
  });
});

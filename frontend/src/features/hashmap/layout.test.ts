import { describe, it, expect } from "vitest";
import { layoutSnapshot } from "./layout";
import type { MapNode, Snapshot } from "../../api/types/index";
const node = (id: number, extra: Partial<MapNode> = {}): MapNode => ({
  id,
  key: { type: "COLLISION", value: `K${id}`, hashCodeOverride: 42 },
  value: "v",
  rawHashCode: 42,
  hash: 42,
  next: null,
  parent: null,
  left: null,
  right: null,
  prev: null,
  red: null,
  linked: true,
  ...extra,
});
const state = (nodes: MapNode[], tree = false): Snapshot => ({
  phase: "COMMITTED",
  size: nodes.length,
  capacity: 64,
  threshold: 48,
  loadFactor: 0.75,
  pendingCapacity: 0,
  pendingBuckets: [],
  buckets: [
    {
      index: 42,
      kind: tree ? "TREE" : "LIST",
      headId: nodes[0].id,
      rootId: tree ? nodes[0].id : null,
      nodes,
    },
  ],
});
describe("layout uses Java links without changing collection state", () => {
  it("places a linked list and keeps the server IDs", () => {
    const s = state([node(17, { next: 5 }), node(5, { next: 90 }), node(90)]);
    const before = JSON.stringify(s),
      d = layoutSnapshot(s);
    expect(d.nodes.map((n) => n.node.id)).toEqual([17, 5, 90]);
    expect(d.edges.map((e) => [e.from, e.to])).toEqual([
      [17, 5],
      [5, 90],
    ]);
    expect(JSON.stringify(s)).toBe(before);
  });
  it("renders the server tree as a tree regardless of node array order", () => {
    const d = layoutSnapshot(
      state(
        [
          node(9, { left: 20, right: 2, red: false }),
          node(2, { parent: 9, red: true }),
          node(20, { parent: 9, red: true }),
        ],
        true,
      ),
    );
    const positions = new Map(d.nodes.map((n) => [n.node.id, n]));
    expect(positions.get(20)!.x).toBeLessThan(positions.get(9)!.x);
    expect(positions.get(2)!.x).toBeGreaterThan(positions.get(9)!.x);
    expect(positions.get(20)!.y).toBeGreaterThan(positions.get(9)!.y);
    expect(d.edges.map((e) => e.label)).toEqual(["L", "R"]);
  });
  it("shows a working forest and tolerates transient cyclic references", () => {
    const d = layoutSnapshot(
      state(
        [
          node(1, { left: 2, red: false }),
          node(2, { left: 1, red: true }),
          node(3, { red: false }),
        ],
        true,
      ),
    );
    expect(new Set(d.nodes.map((n) => n.node.id))).toEqual(new Set([1, 2, 3]));
    expect(d.height).toBeGreaterThan(0);
  });
});

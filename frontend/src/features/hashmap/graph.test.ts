import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/transitions.json";
import type { Snapshot, Step } from "../../api/types";
import { snapshotGraph, pointerFields } from "./graph";
import { layoutSnapshot } from "./layout";

// Exact decoded Java snapshots from the research; never generated algorithm states.
const cases = fixtures as unknown as Record<string, Step<Snapshot>[]>;
describe("HashMap migration presentation", () => {
  for (const [name, physical, temporary] of [
    ["split-6-7", 55, 6],
    ["split-2-7", 51, 2],
  ] as const) {
    it(`${name}: counts only real old table buckets, independently of replacements`, () => {
      const expanded = cases[name].find((s) => s.event === "TABLE_EXPANDED")!;
      const graph = snapshotGraph(expanded.snapshot, expanded);
      expect([
        expanded.snapshot.size,
        expanded.snapshot.buckets.length,
        graph.oldOccupied,
        graph.transferObjects,
      ]).toEqual([49, 0, 31, 0]);
      const step = cases[name].find((s) => s.index === 11)!;
      const split = snapshotGraph(step.snapshot, step);
      expect([
        step.snapshot.size,
        split.nodes.size,
        split.oldOccupied,
        split.transferObjects,
        split.unlinked,
      ]).toEqual([49, physical, 30, temporary, temporary]);
      expect(split.activeGroup).toBe(1);
      expect(
        split.locations.get(Number(step.details.nodeObjectId))?.group,
      ).toBe(1);
    });
    it(`${name}: groups both halves and every physical copy without altering pointers`, () => {
      const step = cases[name].find((s) => s.index === 11)!;
      const before = JSON.stringify(step.snapshot);
      const graph = snapshotGraph(step.snapshot, step);
      const layout = layoutSnapshot(step.snapshot, {
        graph,
        group: 1,
        physical: true,
      });
      expect(layout.bands.map((b) => b.id)).toEqual([
        "table-1",
        "table-65",
        "transfer-1",
      ]);
      const visible = new Set(layout.nodes.map((n) => n.node.objectId));
      expect(visible.size).toBe(layout.nodes.length);
      const key = name === "split-6-7" ? "L3" : "L1";
      const copies = layout.nodes.filter((n) => n.node.key.value === key);
      expect(copies).toHaveLength(2);
      expect(copies[0].node.id).toBe(copies[1].node.id);
      expect(copies[0].node.objectId).not.toBe(copies[1].node.objectId);
      for (const placed of layout.nodes)
        for (const field of pointerFields) {
          const target = placed.node[field];
          if (target === null) continue;
          expect(
            layout.edges.some(
              (e) =>
                e.from === placed.node.objectId &&
                e.field === field &&
                e.to === target,
            ),
          ).toBe(true);
          expect(graph.nodes.has(target)).toBe(true);
        }
      expect(
        layout.edges.some((e) => e.field === "root" && e.areaId === "table-65"),
      ).toBe(true);
      expect(JSON.stringify(step.snapshot)).toBe(before);
      // Related structures fit within their own group rather than 30 old buckets.
      expect(layout.height).toBeLessThan(1600);
    });
  }
  it("RESIZE_STARTED still refers to the original table", () => {
    const step = cases["split-6-7"][0];
    const graph = snapshotGraph(step.snapshot, step);
    expect(graph.starting).toBe(true);
    expect(graph.expanding).toBe(false);
    expect(graph.oldCapacity).toBe(64);
    expect(step.snapshot.buckets).toHaveLength(31);
  });
  it("preserves in-order x positions across real left rotations", () => {
    for (const index of [135, 141]) {
      const steps = cases["tree-remove"];
      const before = layoutSnapshot(
        steps.find((s) => s.index === index - 1)!.snapshot,
      );
      const after = layoutSnapshot(
        steps.find((s) => s.index === index)!.snapshot,
      );
      const positions = new Map(
        before.nodes.map((n) => [n.node.objectId, n.x]),
      );
      for (const node of after.nodes)
        expect(node.x).toBe(positions.get(node.node.objectId));
    }
  });
});

import { describe, it, expect } from "vitest";
import {
  canAnimateTransition,
  transitionDuration,
  changedObjects,
} from "./transitions";
import { layoutSnapshot } from "./layout";
import fixtures from "./fixtures/transitions.json";
import type { Snapshot, Step, Trace } from "../../api/types";
const trace = {} as Trace;
const before = { trace, cursor: 140, view: "tree" };
const after = { trace, cursor: 141, view: "tree" };
describe("HashMap transitions", () => {
  it("only animates adjacent steps within the same trace and camera", () => {
    expect(canAnimateTransition(before, after, "step", false, false)).toBe(
      true,
    );
    expect(canAnimateTransition(after, before, "step", false, false)).toBe(
      true,
    );
    expect(canAnimateTransition(before, after, "play", false, false)).toBe(
      true,
    );
    for (const reason of ["seek"] as const)
      expect(canAnimateTransition(before, after, reason, false, false)).toBe(
        false,
      );
    expect(
      canAnimateTransition(
        before,
        { ...after, cursor: 145 },
        "step",
        false,
        false,
      ),
    ).toBe(false);
    expect(
      canAnimateTransition(
        before,
        { ...after, trace: {} as Trace },
        "play",
        false,
        false,
      ),
    ).toBe(false);
    expect(
      canAnimateTransition(
        before,
        { ...after, view: "other" },
        "play",
        false,
        false,
      ),
    ).toBe(false);
    expect(canAnimateTransition(before, after, "play", true, false)).toBe(
      false,
    );
    expect(canAnimateTransition(before, after, "step", false, true)).toBe(
      false,
    );
    expect(canAnimateTransition(undefined, after, "step", false, false)).toBe(
      false,
    );
  });
  it("finishes before the next playback event at all supported speeds", () => {
    for (const speed of [0.5, 1, 2, 4])
      expect(transitionDuration(speed)).toBeLessThan(1 / speed);
  });
  it("finds all changed nodes from snapshots, including multi-node recoloring", () => {
    const steps = fixtures["tree-remove"] as unknown as Step<Snapshot>[];
    const first = steps.find((s) => s.index === 134)!,
      second = steps.find((s) => s.index === 135)!;
    const from = layoutSnapshot(first.snapshot),
      to = layoutSnapshot(second.snapshot);
    const changed = changedObjects(from, to);
    const recolored = to.nodes.filter(
      ({ node }) =>
        from.nodes.find((n) => n.node.objectId === node.objectId)?.node.red !==
        node.red,
    );
    expect(recolored.length).toBeGreaterThan(1);
    for (const { node } of recolored)
      expect(changed.has(node.objectId)).toBe(true);
    expect(changed.size).toBeGreaterThan(1);
  });
});

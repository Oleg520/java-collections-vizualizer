import { isArray, type Trace } from "../../api/types";
import { snapshotGraph } from "./graph";
import { layoutSnapshot } from "./layout";

/** Only extents are retained. Bounds do not depend on the order frames are visited. */
export function traceLayoutBounds(trace?: Trace) {
  const bounds = new Map<
    number,
    { width: number; height: number; treeWidth?: number }
  >();
  let oldCapacity = 0;
  for (const step of trace?.steps ?? []) {
    if (step.event === "OPERATION_STARTED") oldCapacity = 0;
    if (step.event === "RESIZE_STARTED")
      oldCapacity = Number(step.details.oldCapacity);
    if (isArray(step.snapshot)) continue;
    const layout = layoutSnapshot(step.snapshot, {
      graph: snapshotGraph(
        step.snapshot,
        step,
        oldCapacity || step.snapshot.pendingCapacity,
      ),
    });
    const frame = new Map<number, { width: number; height: number }>();
    for (const band of layout.bands) {
      const extent = frame.get(band.group) ?? { width: 650, height: 0 };
      extent.height += band.height + 22;
      frame.set(band.group, extent);
    }
    for (const node of layout.nodes) {
      const extent = frame.get(node.group)!;
      extent.width = Math.max(extent.width, node.x + 154);
    }
    for (const [group, extent] of frame) {
      const previous = bounds.get(group);
      bounds.set(group, {
        width: Math.max(previous?.width ?? 0, extent.width),
        height: Math.max(previous?.height ?? 0, extent.height),
        treeWidth:
          step.snapshot.phase === "COMMITTED" &&
          layout.bands.some((b) => b.group === group && b.kind === "TREE")
            ? Math.max(previous?.treeWidth ?? 0, extent.width)
            : previous?.treeWidth,
      });
    }
  }
  return bounds;
}

/** Retain the completed split's grouping until this Java operation ends. */
export function resizeGroupingCapacity(
  trace: Trace | undefined,
  cursor: number,
) {
  for (let i = cursor; i >= 0; i--) {
    const step = trace?.steps[i];
    if (!step || step.event === "OPERATION_STARTED") break;
    if (step.event === "RESIZE_STARTED")
      return Number(step.details.oldCapacity);
  }
  return 0;
}

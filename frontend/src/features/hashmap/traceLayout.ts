import { isArray, type Trace } from "../../api/types";
import { layoutSnapshot } from "./layout";

/** Only extents are retained. Bounds do not depend on the order frames are visited. */
export function traceLayoutBounds(trace?: Trace) {
  const bounds = new Map<number, { width: number; height: number }>();
  for (const step of trace?.steps ?? []) {
    if (isArray(step.snapshot)) continue;
    const layout = layoutSnapshot(step.snapshot);
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
      });
    }
  }
  return bounds;
}

import type { MapNode, Snapshot } from "../../api/types";
/** Structural pointers always target physical objectId, never logical id. */
export const objectId = (node: MapNode): number => node.objectId;
export interface NodeSelection {
  logicalId: number;
  preferredObjectId: number;
}
export function resolveSelection(state: Snapshot, selected?: NodeSelection) {
  if (!selected) return undefined;
  const nodes = [...state.buckets, ...state.pendingBuckets].flatMap(
    (b) => b.nodes,
  );
  const exact = nodes.find(
    (n) =>
      objectId(n) === selected.preferredObjectId && n.id === selected.logicalId,
  );
  if (exact) return exact;
  const live = nodes.filter((n) => n.id === selected.logicalId && n.linked);
  return live.length === 1 ? live[0] : undefined;
}

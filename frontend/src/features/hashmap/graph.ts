import type { Bucket, MapNode, Snapshot, Step } from "../../api/types";

export type AreaSource = "table" | "old" | "transfer";
export interface Area {
  id: string;
  source: AreaSource;
  group: number;
  bucket: Bucket;
}
export const pointerFields = [
  "left",
  "right",
  "parent",
  "next",
  "prev",
] as const;
export type PointerField = (typeof pointerFields)[number] | "head" | "root";
export interface Edge {
  id: string;
  from: number | null;
  to: number;
  field: PointerField;
  label: string;
  tree: boolean;
  areaId?: string;
}

/** Areas describe snapshot placement, never inferred Java ownership. */
export function snapshotGraph(state: Snapshot, step?: Step) {
  const expanding = state.pendingCapacity > 0;
  const starting = step?.event === "RESIZE_STARTED";
  const oldCapacity = expanding
    ? state.pendingCapacity
    : starting
      ? state.capacity
      : 0;
  const areas: Area[] = [
    ...state.buckets.map((bucket) => ({
      id: `table-${bucket.index}`,
      source: "table" as const,
      group: expanding ? bucket.index % oldCapacity : bucket.index,
      bucket,
    })),
    ...state.pendingBuckets.map((bucket) => ({
      id: `${bucket.kind === "TRANSFER" ? "transfer" : "old"}-${bucket.index}`,
      source:
        bucket.kind === "TRANSFER" ? ("transfer" as const) : ("old" as const),
      group: bucket.index,
      bucket,
    })),
  ];
  const nodes = new Map<number, MapNode>();
  const locations = new Map<number, Area>();
  const edges: Edge[] = [];
  for (const area of areas) {
    for (const node of area.bucket.nodes) {
      nodes.set(node.objectId, node);
      locations.set(node.objectId, area);
      for (const field of pointerFields) {
        const to = node[field];
        if (to === null) continue;
        const label = field === "left" ? "L" : field === "right" ? "R" : field;
        edges.push({
          id: `${label}-${node.objectId}-${to}`,
          from: node.objectId,
          to,
          field,
          label,
          tree: field === "left" || field === "right",
        });
      }
    }
    for (const field of ["head", "root"] as const) {
      const to = field === "head" ? area.bucket.headId : area.bucket.rootId;
      if (to !== null)
        edges.push({
          id: `${area.id}-${field}-${to}`,
          from: null,
          to,
          field,
          label: field,
          tree: false,
          areaId: area.id,
        });
    }
  }
  const oldBuckets = areas.filter((a) => a.source === "old");
  const transfers = areas.filter((a) => a.source === "transfer");
  const details = step?.details ?? {};
  const index = [
    details.fromBucket,
    details.bucketIndex,
    details.toBucket,
  ].find((v) => typeof v === "number");
  const activeGroup =
    typeof index === "number"
      ? expanding
        ? index % oldCapacity
        : index
      : typeof details.nodeObjectId === "number"
        ? locations.get(details.nodeObjectId)?.group
        : undefined;
  return {
    areas,
    nodes,
    locations,
    edges,
    oldCapacity,
    expanding,
    starting,
    activeGroup,
    oldOccupied: oldBuckets.length,
    transferObjects: transfers.reduce((n, a) => n + a.bucket.nodes.length, 0),
    unlinked: [...nodes.values()].filter((n) => !n.linked).length,
  };
}
export type SnapshotGraph = ReturnType<typeof snapshotGraph>;
export function areaLabel(area: Area, graph: SnapshotGraph) {
  return area.source === "transfer"
    ? `Временные объекты [${area.bucket.index}]`
    : area.source === "old" || graph.starting
      ? `Старая таблица [${area.bucket.index}]`
      : graph.expanding
        ? `Новая таблица [${area.bucket.index}]`
        : `Бакет [${area.bucket.index}]`;
}

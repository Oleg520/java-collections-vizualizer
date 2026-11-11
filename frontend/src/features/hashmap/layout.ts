import type { MapNode, Snapshot } from "../../api/types";
import {
  snapshotGraph,
  type Area,
  type Edge,
  type SnapshotGraph,
} from "./graph";
export type { Edge } from "./graph";
export interface PlacedNode {
  node: MapNode;
  x: number;
  y: number;
  bucket: number;
  pending: boolean;
  areaId: string;
  group: number;
}
export interface Band {
  id: string;
  index: number;
  group: number;
  y: number;
  height: number;
  kind: string;
  pending: boolean;
  area: Area;
}
export interface Diagram {
  nodes: PlacedNode[];
  edges: Edge[];
  bands: Band[];
  width: number;
  height: number;
}
export interface LayoutOptions {
  graph?: SnapshotGraph;
  group?: number | null;
  physical?: boolean;
  bounds?: Map<number, { width: number; height: number }>;
}

/** Follows physical links, including forests/cycles in WORKING. Never balances a tree. */
export function layoutSnapshot(
  state: Snapshot,
  options: LayoutOptions = {},
): Diagram {
  const graph = options.graph ?? snapshotGraph(state);
  const nodes: PlacedNode[] = [],
    bands: Band[] = [];
  let top = 30,
    width = 650;
  const groups = new Map<number, Area[]>();
  for (const area of graph.areas) {
    if (options.group != null && area.group !== options.group) continue;
    const group = groups.get(area.group) ?? [];
    group.push(area);
    groups.set(area.group, group);
  }
  for (const [groupIndex, areas] of [...groups].sort(([a], [b]) => a - b)) {
    const groupTop = top;
    // Keep related halves and temporary objects together, ahead of unrelated buckets.
    areas.sort(
      (a, b) =>
        ({ old: 0, table: 1, transfer: 2 })[a.source] -
          { old: 0, table: 1, transfer: 2 }[b.source] ||
        a.bucket.index - b.bucket.index,
    );
    for (const area of areas) {
      const bucket = area.bucket;
      const byId = new Map(bucket.nodes.map((n) => [n.objectId, n]));
      const local = new Map<number, { x: number; y: number }>();
      let rank = 0,
        depth = 0;
      const visited = new Set<number>();
      const walk = (id: number | null, level: number) => {
        if (id === null || visited.has(id) || !byId.has(id)) return;
        visited.add(id);
        const node = byId.get(id)!;
        walk(node.left, level + 1);
        local.set(id, { x: 170 + rank++ * 78, y: top + level * 103 });
        depth = Math.max(depth, level);
        walk(node.right, level + 1);
      };
      if (bucket.nodes.some((n) => n.red !== null)) {
        walk(bucket.rootId, 0);
        // Actual local roots first; a root may also live in another snapshot area.
        for (const n of bucket.nodes)
          if (n.parent === null || !byId.has(n.parent)) {
            if (!visited.has(n.objectId)) {
              if (rank) rank++;
              walk(n.objectId, 0);
            }
          }
        for (const n of bucket.nodes)
          if (!visited.has(n.objectId)) {
            if (rank) rank++;
            walk(n.objectId, 0);
          }
      } else {
        for (const n of bucket.nodes)
          local.set(n.objectId, { x: 170 + rank++ * 160, y: top });
      }
      for (const node of bucket.nodes) {
        const position = local.get(node.objectId)!;
        nodes.push({
          node,
          ...position,
          bucket: bucket.index,
          pending: area.source !== "table",
          areaId: area.id,
          group: groupIndex,
        });
        width = Math.max(width, position.x + 154);
      }
      const height = Math.max(112, (depth + 1) * 103 + 16);
      bands.push({
        id: area.id,
        index: bucket.index,
        group: groupIndex,
        y: top - 15,
        height,
        kind: bucket.kind,
        pending: area.source !== "table",
        area,
      });
      top += height + 22;
    }
    const reserved = options.bounds?.get(groupIndex);
    if (reserved) {
      width = Math.max(width, reserved.width);
      top = groupTop + Math.max(top - groupTop, reserved.height);
    }
  }
  const visible = new Set(nodes.map((n) => n.node.objectId));
  const bandIds = new Set(bands.map((b) => b.id));
  const edges = graph.edges.filter(
    (e) =>
      (e.from === null ? bandIds.has(e.areaId!) : visible.has(e.from)) &&
      (options.physical ||
        e.tree ||
        (e.field === "next" && graph.nodes.get(e.from!)?.red === null)),
  );
  return { nodes, edges, bands, width, height: Math.max(280, top + 10) };
}

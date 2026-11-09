import type { Bucket, MapNode, Snapshot } from "../../api/types/index";
export interface PlacedNode {
  node: MapNode;
  x: number;
  y: number;
  bucket: number;
  pending: boolean;
}
export interface Edge {
  id: string;
  from: number;
  to: number;
  label: string;
  tree: boolean;
}
export interface Band {
  id: string;
  index: number;
  y: number;
  height: number;
  kind: string;
  pending: boolean;
}
export interface Diagram {
  nodes: PlacedNode[];
  edges: Edge[];
  bands: Band[];
  width: number;
  height: number;
}

/** Presentation only: follows server-provided links. No hashing or tree balancing here. */
export function layoutSnapshot(state: Snapshot): Diagram {
  const nodes: PlacedNode[] = [],
    edges: Edge[] = [],
    bands: Band[] = [];
  const positioned = new Set<number>();
  let top = 30,
    width = 650;
  const placeBucket = (bucket: Bucket, pending: boolean) => {
    const byId = new Map(bucket.nodes.map((n) => [n.id, n]));
    const local = new Map<number, { x: number; y: number }>();
    let rank = 0,
      depth = 0;
    const visiting = new Set<number>();
    const walk = (id: number | null, level: number): number | undefined => {
      if (id === null || visiting.has(id) || !byId.has(id)) return;
      visiting.add(id);
      const n = byId.get(id)!;
      const left = walk(n.left, level + 1);
      const right = walk(n.right, level + 1);
      const x =
        left !== undefined && right !== undefined
          ? (left + right) / 2
          : (left ?? right ?? 170 + rank++ * 150);
      local.set(id, { x, y: top + level * 103 });
      depth = Math.max(depth, level);
      return x;
    };
    if (bucket.kind === "TREE") {
      walk(bucket.rootId, 0);
      // During treeification some nodes are still in a forest; show them too.
      for (const n of bucket.nodes) if (!visiting.has(n.id)) walk(n.id, 0);
    } else {
      for (const n of bucket.nodes)
        local.set(n.id, { x: 170 + rank++ * 160, y: top });
    }
    for (const n of bucket.nodes) {
      const position = local.get(n.id);
      if (!position || positioned.has(n.id)) continue;
      positioned.add(n.id);
      nodes.push({ node: n, ...position, bucket: bucket.index, pending });
      width = Math.max(width, position.x + 154);
      if (bucket.kind === "TREE") {
        if (n.left !== null)
          edges.push({
            id: `${n.id}-${n.left}`,
            from: n.id,
            to: n.left,
            label: "L",
            tree: true,
          });
        if (n.right !== null)
          edges.push({
            id: `${n.id}-${n.right}`,
            from: n.id,
            to: n.right,
            label: "R",
            tree: true,
          });
      } else if (bucket.kind === "LIST" && n.next !== null)
        edges.push({
          id: `${n.id}-${n.next}`,
          from: n.id,
          to: n.next,
          label: "next",
          tree: false,
        });
    }
    const height = Math.max(106, (depth + 1) * 103 + 10);
    bands.push({
      id: `${pending ? "old" : "new"}-${bucket.index}`,
      index: bucket.index,
      y: top - 15,
      height,
      kind: bucket.kind,
      pending,
    });
    top += height + 22;
  };
  state.buckets.forEach((b) => placeBucket(b, false));
  state.pendingBuckets.forEach((b) => placeBucket(b, true));
  return { nodes, edges, bands, width, height: Math.max(280, top + 10) };
}

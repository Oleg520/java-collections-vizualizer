import type {
  Bucket,
  MapNode,
  SessionTrace,
  Snapshot,
  Step,
  Trace,
} from "../types";

export interface BucketRefs extends Omit<Bucket, "nodes"> {
  nodeRefs: number[];
}
export interface Frame extends Omit<Snapshot, "buckets" | "pendingBuckets"> {
  buckets: BucketRefs[];
  pendingBuckets: BucketRefs[];
}
export interface CompactSessionTrace extends Omit<SessionTrace, "trace"> {
  encoding: "node-table-v2";
  nodePool: MapNode[];
  trace: Omit<Trace<Snapshot>, "before" | "committed" | "steps"> & {
    before: Frame;
    committed: Frame;
    steps: (Omit<Step<Snapshot>, "snapshot"> & { snapshot: Frame })[];
  };
}
/** Resolves absolute references while sharing immutable node versions. */
export function decodeHashMapTrace(
  response: CompactSessionTrace,
): SessionTrace {
  const buckets = (items: BucketRefs[]): Bucket[] =>
    items.map(({ nodeRefs, ...bucket }) => ({
      ...bucket,
      nodes: nodeRefs.map((index) => {
        if (!Number.isInteger(index) || !response.nodePool[index])
          throw new Error("Повреждённая ссылка в trace");
        const node = response.nodePool[index];
        if (!Number.isSafeInteger(node.objectId) || node.objectId! <= 0)
          throw new Error("Повреждённый objectId в trace");
        return node;
      }),
    }));
  const frame = (source: Frame): Snapshot => {
    const result = {
      ...source,
      buckets: buckets(source.buckets),
      pendingBuckets: buckets(source.pendingBuckets),
    };
    validatePhysicalSnapshot(result);
    return result;
  };
  if (response.schemaVersion !== 2 || response.trace.schemaVersion !== 2)
    throw new Error("Несовместимая версия HashMap trace");
  return {
    schemaVersion: response.schemaVersion,
    sessionId: response.sessionId,
    revision: response.revision,
    trace: {
      ...response.trace,
      before: frame(response.trace.before),
      committed: frame(response.trace.committed),
      steps: response.trace.steps.map((s) => ({
        ...s,
        snapshot: frame(s.snapshot),
      })),
    },
  };
}

/** Validate addressing, not red-black invariants: WORKING may be a temporary forest. */
export function validatePhysicalSnapshot(state: Snapshot): void {
  const buckets = [...state.buckets, ...state.pendingBuckets];
  const nodes = buckets.flatMap((b) => b.nodes);
  const ids = new Set(nodes.map((n) => n.objectId));
  if (
    ids.size !== nodes.length ||
    nodes.some((n) => !Number.isSafeInteger(n.objectId) || n.objectId <= 0)
  )
    throw new Error("Неоднозначный objectId в snapshot");
  const refs = buckets.flatMap((b) => [b.headId, b.rootId]);
  for (const node of nodes)
    refs.push(node.next, node.prev, node.parent, node.left, node.right);
  if (refs.some((id) => id !== null && !ids.has(id)))
    throw new Error("Повреждённая физическая ссылка snapshot");
}

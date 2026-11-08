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
  encoding: "node-table-v1";
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
        return response.nodePool[index];
      }),
    }));
  const frame = (source: Frame): Snapshot => ({
    ...source,
    buckets: buckets(source.buckets),
    pendingBuckets: buckets(source.pendingBuckets),
  });
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

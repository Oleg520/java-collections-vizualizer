import type {
  ArrayBuffer,
  ArraySnapshot,
  Bucket,
  Cell,
  MapNode,
  SessionTrace,
  Snapshot,
  Step,
  Trace,
} from "./types";
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
/** Resolves absolute references only. Shared, immutable node versions keep history small. */
export function decodeTrace(
  response: SessionTrace | CompactSessionTrace | CompactArrayTrace,
): SessionTrace {
  if (!("encoding" in response)) return response;
  if (response.encoding === "array-frames-v1")
    return decodeArrayTrace(response);
  if (response.encoding !== "node-table-v1")
    throw new Error("Неизвестный формат trace");
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

export interface ArrayFrame
  extends Omit<ArraySnapshot, "buffer" | "pendingBuffer"> {
  bufferRef: number;
  pendingBufferRef: number | null;
}
export interface CompactArrayTrace extends Omit<SessionTrace, "trace"> {
  encoding: "array-frames-v1";
  cellPool: Cell[];
  bufferPool: { id: number; capacity: number; cellRefs: (number | null)[] }[];
  trace: Trace<ArrayFrame>;
}
function decodeArrayTrace(response: CompactArrayTrace): SessionTrace {
  const ref = <T>(pool: T[], index: number): T => {
    if (!Number.isInteger(index) || index < 0 || index >= pool.length)
      throw new Error("Повреждённая ссылка в trace");
    return pool[index];
  };
  const buffers: ArrayBuffer[] = response.bufferPool.map((b) => {
    if (b.capacity !== b.cellRefs.length)
      throw new Error("Повреждённый буфер trace");
    return {
      id: b.id,
      capacity: b.capacity,
      cells: b.cellRefs.map((i) =>
        i === null ? null : ref(response.cellPool, i),
      ),
    };
  });
  const frame = ({
    bufferRef,
    pendingBufferRef,
    ...s
  }: ArrayFrame): ArraySnapshot => ({
    ...s,
    buffer: ref(buffers, bufferRef),
    pendingBuffer:
      pendingBufferRef === null ? null : ref(buffers, pendingBufferRef),
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

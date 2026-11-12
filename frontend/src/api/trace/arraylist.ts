import { ClientError } from "../../i18n/errors";
import type {
  ArrayBuffer,
  ArraySnapshot,
  Cell,
  SessionTrace,
  Trace,
} from "../types";

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
export function decodeArrayTrace(response: CompactArrayTrace): SessionTrace {
  const ref = <T>(pool: T[], index: number): T => {
    if (!Number.isInteger(index) || index < 0 || index >= pool.length)
      throw new ClientError("errors.corruptReference");
    return pool[index];
  };
  const buffers: ArrayBuffer[] = response.bufferPool.map((b) => {
    if (b.capacity !== b.cellRefs.length)
      throw new ClientError("errors.corruptBuffer");
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

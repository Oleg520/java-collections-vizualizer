import { ClientError } from "../../i18n/errors";
import type { SessionTrace, Snapshot } from "../types";
import {
  decodeHashMapTrace,
  validatePhysicalSnapshot,
  type CompactSessionTrace,
} from "./hashmap";
import { decodeArrayTrace, type CompactArrayTrace } from "./arraylist";
export type { CompactSessionTrace, Frame } from "./hashmap";
export type { CompactArrayTrace, ArrayFrame } from "./arraylist";

export function decodeTrace(
  response: SessionTrace | CompactSessionTrace | CompactArrayTrace,
): SessionTrace {
  if (!("encoding" in response)) {
    if (
      response.trace.collection === "HASH_MAP" &&
      (response.schemaVersion !== 2 || response.trace.schemaVersion !== 2)
    )
      throw new ClientError("errors.traceVersion");
    if (response.trace.collection === "HASH_MAP") {
      validatePhysicalSnapshot(response.trace.before as Snapshot);
      response.trace.steps.forEach((s) =>
        validatePhysicalSnapshot(s.snapshot as Snapshot),
      );
      validatePhysicalSnapshot(response.trace.committed as Snapshot);
    }
    return response;
  }
  if (response.encoding === "array-frames-v1")
    return decodeArrayTrace(response);
  if (response.encoding === "node-table-v2")
    return decodeHashMapTrace(response);
  throw new ClientError("errors.traceFormat");
}

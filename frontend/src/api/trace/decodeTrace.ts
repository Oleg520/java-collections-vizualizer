import type { SessionTrace } from "../types";
import { decodeHashMapTrace, type CompactSessionTrace } from "./hashmap";
import { decodeArrayTrace, type CompactArrayTrace } from "./arraylist";
export type { CompactSessionTrace, Frame } from "./hashmap";
export type { CompactArrayTrace, ArrayFrame } from "./arraylist";

export function decodeTrace(
  response: SessionTrace | CompactSessionTrace | CompactArrayTrace,
): SessionTrace {
  if (!("encoding" in response)) return response;
  if (response.encoding === "array-frames-v1")
    return decodeArrayTrace(response);
  if (response.encoding === "node-table-v1")
    return decodeHashMapTrace(response);
  throw new Error("Неизвестный формат trace");
}

import type { KeySpec, CommandType, Snapshot } from "./hashmap";
import type { Element, ArrayCommand, ArraySnapshot } from "./arraylist";

export type CollectionType = "HASH_MAP" | "ARRAY_LIST";
export type CollectionSnapshot = Snapshot | ArraySnapshot;
export function isArray(s: CollectionSnapshot): s is ArraySnapshot {
  return "collection" in s && s.collection === "ARRAY_LIST";
}
export interface Operation {
  type: CommandType | ArrayCommand | "SCENARIO";
  index?: number | null;
  element?: Element | null;
  minCapacity?: number | null;
  key: KeySpec | null;
  value: string | null;
}
export interface Step<S = CollectionSnapshot> {
  index: number;
  operation: Operation;
  event: string;
  stage: string;
  message: string;
  details: Record<string, unknown>;
  snapshot: S;
}
export interface Trace<S = CollectionSnapshot> {
  schemaVersion: number;
  collection: string;
  operation: Operation;
  result: {
    kind?: "ELEMENT" | "BOOLEAN" | "INT" | "VOID" | "RESET" | null;
    element?: Element | null;
    booleanValue?: boolean | null;
    intValue?: number | null;
    found: boolean;
    previousValue: string | null;
    value: string | null;
  };
  before: S;
  steps: Step<S>[];
  committed: S;
}
export interface Session {
  schemaVersion: number;
  id: string;
  collection: string;
  revision: number;
  expiresInSeconds: number;
  state: CollectionSnapshot;
}
export interface SessionTrace {
  schemaVersion: number;
  sessionId: string;
  revision: number;
  trace: Trace;
}
export interface Scenario {
  id: string;
  title: string;
  description: string;
}

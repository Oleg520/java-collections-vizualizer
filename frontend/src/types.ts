export type KeyType = "STRING" | "INTEGER" | "COLLISION" | "NULL";
export interface KeySpec {
  type: KeyType;
  value: string | null;
  hashCodeOverride: number | null;
}
export type CommandType = "PUT" | "GET" | "REMOVE" | "CLEAR" | "RESET";
export type CollectionType = "HASH_MAP" | "ARRAY_LIST";
export type ArrayCommand =
  | "ADD"
  | "ADD_AT"
  | "GET_AT"
  | "SET_AT"
  | "REMOVE_AT"
  | "INDEX_OF"
  | "ENSURE_CAPACITY"
  | "TRIM_TO_SIZE"
  | "CLEAR"
  | "RESET";
export interface Element {
  type: "STRING" | "INTEGER" | "NULL";
  value: string | null;
}
export interface Cell {
  id: number;
  element: Element;
}
export interface ArrayBuffer {
  id: number;
  capacity: number;
  cells: (Cell | null)[];
}
export interface ArraySnapshot {
  collection: "ARRAY_LIST";
  phase: "WORKING" | "COMMITTED";
  size: number;
  capacity: number;
  emptyMode: "DEFAULT_EMPTY" | "EXPLICIT_EMPTY" | "ALLOCATED";
  initialCapacity: number | null;
  buffer: ArrayBuffer;
  pendingBuffer: ArrayBuffer | null;
}
export type CollectionSnapshot = Snapshot | ArraySnapshot;
export function isArray(s: CollectionSnapshot): s is ArraySnapshot {
  return "collection" in s && s.collection === "ARRAY_LIST";
}
export const elementLabel = (e: Element) =>
  e.type === "NULL"
    ? "null"
    : e.type === "STRING"
      ? JSON.stringify(e.value)
      : (e.value ?? "");
export interface Operation {
  type: CommandType | ArrayCommand | "SCENARIO";
  index?: number | null;
  element?: Element | null;
  minCapacity?: number | null;
  key: KeySpec | null;
  value: string | null;
}
export interface MapNode {
  id: number;
  key: KeySpec;
  value: string | null;
  rawHashCode: number;
  hash: number;
  next: number | null;
  parent: number | null;
  left: number | null;
  right: number | null;
  prev: number | null;
  red: boolean | null;
  linked: boolean;
}
export interface Bucket {
  index: number;
  kind: "LIST" | "TREE" | "TRANSFER";
  headId: number;
  rootId: number | null;
  nodes: MapNode[];
}
export interface Snapshot {
  phase: "WORKING" | "COMMITTED";
  size: number;
  capacity: number;
  threshold: number;
  loadFactor: number;
  pendingCapacity: number;
  buckets: Bucket[];
  pendingBuckets: Bucket[];
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
export const keyLabel = (key: KeySpec): string =>
  key.type === "NULL"
    ? "null"
    : key.type === "STRING"
      ? JSON.stringify(key.value)
      : (key.value ?? "");
export const valueLabel = (value: string | null): string =>
  value === null ? "null" : JSON.stringify(value);
export const operationLabel = (op: Operation): string =>
  op.element || op.index != null || op.minCapacity != null
    ? `${({ ADD_AT: "add", GET_AT: "get", SET_AT: "set", REMOVE_AT: "remove", INDEX_OF: "indexOf", ENSURE_CAPACITY: "ensureCapacity" } as Record<string, string>)[op.type] ?? op.type.toLowerCase()}(${[op.index, op.element ? elementLabel(op.element) : undefined, op.minCapacity].filter((v) => v != null).join(", ")})`
    : op.type === "TRIM_TO_SIZE"
      ? "trimToSize()"
      : op.type === "SCENARIO"
        ? `demo / ${op.value}`
        : `${op.type.toLowerCase()}(${op.key ? keyLabel(op.key) : ""}${op.type === "PUT" ? ", " + valueLabel(op.value) : ""})`;

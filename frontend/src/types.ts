export type KeyType = "STRING" | "INTEGER" | "COLLISION" | "NULL";
export interface KeySpec {
  type: KeyType;
  value: string | null;
  hashCodeOverride: number | null;
}
export type CommandType = "PUT" | "GET" | "REMOVE" | "CLEAR" | "RESET";
export interface Operation {
  type: CommandType | "SCENARIO";
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
export interface Step {
  index: number;
  operation: Operation;
  event: string;
  stage: string;
  message: string;
  details: Record<string, unknown>;
  snapshot: Snapshot;
}
export interface Trace {
  schemaVersion: number;
  collection: string;
  operation: Operation;
  result: {
    found: boolean;
    previousValue: string | null;
    value: string | null;
  };
  before: Snapshot;
  steps: Step[];
  committed: Snapshot;
}
export interface Session {
  schemaVersion: number;
  id: string;
  collection: string;
  revision: number;
  expiresInSeconds: number;
  state: Snapshot;
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
  op.type === "SCENARIO"
    ? `demo / ${op.value}`
    : `${op.type.toLowerCase()}(${op.key ? keyLabel(op.key) : ""}${op.type === "PUT" ? ", " + valueLabel(op.value) : ""})`;

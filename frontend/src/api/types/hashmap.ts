export type KeyType = "STRING" | "INTEGER" | "COLLISION" | "NULL";
export interface KeySpec {
  type: KeyType;
  value: string | null;
  hashCodeOverride: number | null;
}
export type CommandType = "PUT" | "GET" | "REMOVE" | "CLEAR" | "RESET";
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

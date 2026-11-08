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

import { scenarioText } from "../i18n/scenarios";
import type { Locale } from "../i18n/locale";
import type { Operation } from "../api/types";
import { keyLabel, valueLabel } from "../features/hashmap/presentation";
import { elementLabel } from "../features/arraylist/presentation";

export function operationLabel(
  op: Operation,
  locale?: Locale,
  collection = "HASH_MAP",
): string {
  const key = op.key ? keyLabel(op.key) : "";
  const element = op.element ? elementLabel(op.element) : "";
  const index = op.index ?? "";
  switch (op.type) {
    case "SCENARIO":
      return locale
        ? scenarioText(locale, collection, op.value ?? "").title
        : `demo / ${op.value}`;
    case "PUT":
      return `put(${key}, ${valueLabel(op.value)})`;
    case "GET":
    case "REMOVE":
      return `${op.type.toLowerCase()}(${key})`;
    case "ADD":
      return `add(${element})`;
    case "ADD_AT":
      return `add(${index}, ${element})`;
    case "GET_AT":
      return `get(${index})`;
    case "SET_AT":
      return `set(${index}, ${element})`;
    case "REMOVE_AT":
      return `remove(${index})`;
    case "INDEX_OF":
      return `indexOf(${element})`;
    case "ENSURE_CAPACITY":
      return `ensureCapacity(${op.minCapacity ?? ""})`;
    case "TRIM_TO_SIZE":
      return "trimToSize()";
    case "CLEAR":
    case "RESET":
      return `${op.type.toLowerCase()}()`;
  }
}

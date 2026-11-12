import { russian, type Translator } from "../../i18n/locale";
import type { Trace, ArraySnapshot } from "../../api/types";
import type { Element } from "../../api/types";

export const elementLabel = (e: Element) =>
  e.type === "NULL"
    ? "null"
    : e.type === "STRING"
      ? JSON.stringify(e.value)
      : (e.value ?? "");

export const algorithm = (t: Translator = russian) => [
  [
    "operation",
    "add / get / set / remove / indexOf",
    t("arraylist.presentation.operation_start_and_result_commit"),
  ],
  [
    "index",
    "0 ≤ index < size (add: ≤ size)",
    t("arraylist.presentation.bounds_check_direct_access"),
  ],
  [
    "capacity",
    "old + max(minGrowth, old >> 1)",
    t("arraylist.presentation.openjdk_21_default_empty_max_10"),
  ],
  [
    "shift",
    "System.arraycopy",
    t("arraylist.presentation.one_block_operation_moves_references_objects"),
  ],
  [
    "mutation",
    "elementData[index] = element",
    t("arraylist.presentation.write_replace_or_clear_a_reference"),
  ],
  [
    "search",
    "null / equals",
    t("arraylist.presentation.linear_search_for_the_first_match"),
  ],
];

export function resultText(trace: Trace, t: Translator = russian) {
  const r = trace.result;
  if (r.kind === "ELEMENT" && r.element) return elementLabel(r.element);
  if (r.kind === "INT") return String(r.intValue);
  if (r.kind === "BOOLEAN") return String(r.booleanValue);
  return r.kind === "RESET"
    ? t("arraylist.presentation.new_collection")
    : "void";
}

export function metrics(snapshot: ArraySnapshot, t: Translator = russian) {
  return [
    {
      label: "size",
      value: snapshot.size,
      caption: t("arraylist.presentation.number_of_entries"),
    },
    {
      label: "capacity",
      value: snapshot.capacity,
      caption:
        snapshot.capacity === 0
          ? t("arraylist.presentation.array_not_allocated")
          : t("arraylist.presentation.allocated_slots"),
    },
    {
      label: "free",
      value: snapshot.capacity - snapshot.size,
      caption: t("arraylist.presentation.free_positions"),
    },
    {
      label: "buffer",
      value: `#${snapshot.buffer.id}`,
      caption: t("arraylist.presentation.teaching_array_version"),
    },
  ];
}

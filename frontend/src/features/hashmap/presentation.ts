import { russian, type Translator } from "../../i18n/locale";
import type { Trace, Snapshot } from "../../api/types";
import type { KeySpec } from "../../api/types";

export const keyLabel = (key: KeySpec): string =>
  key.type === "NULL"
    ? "null"
    : key.type === "STRING"
      ? JSON.stringify(key.value)
      : (key.value ?? "");
export const valueLabel = (value: string | null): string =>
  value === null ? "null" : JSON.stringify(value);

export const algorithm = (t: Translator = russian) => [
  [
    "operation",
    "put / get / remove",
    t("hashmap.presentation.operation_start_and_result_commit"),
  ],
  [
    "hash",
    "h ^ (h >>> 16)",
    t("hashmap.presentation.high_bits_influence_low_bits_null"),
  ],
  [
    "index",
    "(capacity - 1) & hash",
    t("hashmap.presentation.select_a_bucket_in_a_power"),
  ],
  [
    "search",
    "hash == h && key.equals(k)",
    t("hashmap.presentation.check_the_head_chain_or_tree"),
  ],
  [
    "mutation",
    "link / replace / unlink",
    t("hashmap.presentation.change_the_value_links_and_size"),
  ],
  [
    "tree",
    "treeifyBin / balance / untreeify",
    t("hashmap.presentation.on_put_the_9th_node_and"),
  ],
  [
    "resize",
    "(hash & oldCapacity) == 0",
    t("hashmap.presentation.keep_the_index_or_add_oldcapacity"),
  ],
];

export function resultText(trace: Trace, t: Translator = russian) {
  const type = trace.operation.type;
  if (type === "GET")
    return trace.result.found
      ? valueLabel(trace.result.value)
      : t("hashmap.presentation.null_not_found");
  if (type === "PUT")
    return trace.result.found
      ? t("hashmap.presentation.previously", {
          "0": valueLabel(trace.result.previousValue),
        })
      : t("hashmap.presentation.null_new_key");
  if (type === "REMOVE")
    return trace.result.found
      ? t("hashmap.presentation.removed", {
          "0": valueLabel(trace.result.previousValue),
        })
      : t("hashmap.presentation.null_not_found");
  if (type === "SCENARIO")
    return t("scenarioDone", { count: trace.committed.size });
  return type === "CLEAR"
    ? t("hashmap.presentation.collection_cleared")
    : t("arraylist.presentation.new_collection");
}

export function metrics(snapshot?: Snapshot, t: Translator = russian) {
  return [
    {
      label: "size",
      value: snapshot?.size ?? "—",
      caption: t("arraylist.presentation.number_of_entries"),
    },
    {
      label: "capacity",
      value: snapshot?.capacity ?? "—",
      caption:
        snapshot?.capacity === 0
          ? t("arraylist.presentation.array_not_allocated")
          : t("hashmap.presentation.allocated_buckets"),
    },
    {
      label: "threshold",
      value: snapshot?.threshold ?? "—",
      caption:
        snapshot?.capacity === 0 && snapshot.threshold > 0
          ? t("hashmap.presentation.target_initial_capacity")
          : t("hashmap.presentation.resize_when_size_threshold"),
    },
    {
      label: "loadFactor",
      value: snapshot?.loadFactor ?? ".75",
      caption: t("hashmap.presentation.load_factor"),
    },
  ];
}

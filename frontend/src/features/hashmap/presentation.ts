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

export const algorithm = [
  ["operation", "put / get / remove", "Начало операции и фиксация результата"],
  ["hash", "h ^ (h >>> 16)", "Старшие биты влияют на младшие. null → 0"],
  ["index", "(capacity - 1) & hash", "Выбор бакета в таблице степени двойки"],
  [
    "search",
    "hash == h && key.equals(k)",
    "Проверка головы, цепочки или дерева",
  ],
  ["mutation", "link / replace / unlink", "Изменение значения, ссылок и size"],
  [
    "tree",
    "treeifyBin / balance / untreeify",
    "При put: 9-й узел и capacity ≥ 64",
  ],
  [
    "resize",
    "(hash & oldCapacity) == 0",
    "Оставить индекс или прибавить oldCapacity",
  ],
];

export function resultText(trace: Trace) {
  const type = trace.operation.type;
  if (type === "GET")
    return trace.result.found
      ? valueLabel(trace.result.value)
      : "null · не найден";
  if (type === "PUT")
    return trace.result.found
      ? `было ${valueLabel(trace.result.previousValue)}`
      : "null · новый ключ";
  if (type === "REMOVE")
    return trace.result.found
      ? `удалено ${valueLabel(trace.result.previousValue)}`
      : "null · не найден";
  if (type === "SCENARIO") return `${trace.committed.size} записей · готово`;
  return type === "CLEAR" ? "Коллекция очищена" : "Новая коллекция";
}

export function metrics(snapshot?: Snapshot) {
  return [
    {
      label: "size",
      value: snapshot?.size ?? "—",
      caption: "количество записей",
    },
    {
      label: "capacity",
      value: snapshot?.capacity ?? "—",
      caption:
        snapshot?.capacity === 0 ? "массив не выделен" : "выделенных бакетов",
    },
    {
      label: "threshold",
      value: snapshot?.threshold ?? "—",
      caption:
        snapshot?.capacity === 0 && snapshot.threshold > 0
          ? "целевая начальная ёмкость"
          : "resize при size > threshold",
    },
    {
      label: "loadFactor",
      value: snapshot?.loadFactor ?? ".75",
      caption: "коэффициент загрузки",
    },
  ];
}

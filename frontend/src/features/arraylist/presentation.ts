import type { Trace, ArraySnapshot } from "../../api/types";
import type { Element } from "../../api/types";

export const elementLabel = (e: Element) =>
  e.type === "NULL"
    ? "null"
    : e.type === "STRING"
      ? JSON.stringify(e.value)
      : (e.value ?? "");

export const algorithm = [
  [
    "operation",
    "add / get / set / remove / indexOf",
    "Начало и фиксация результата",
  ],
  ["index", "0 ≤ index < size (add: ≤ size)", "Проверка границ; прямой доступ"],
  [
    "capacity",
    "old + max(minGrowth, old >> 1)",
    "OpenJDK 21: default-empty → max(10, minCapacity); explicit-empty → 1 при add",
  ],
  [
    "shift",
    "System.arraycopy",
    "Одна блочная операция перемещает ссылки; объекты не клонируются",
  ],
  [
    "mutation",
    "elementData[index] = element",
    "Запись, замена или очистка ссылки",
  ],
  ["search", "null / equals", "Линейный поиск первого совпадения"],
];

export function resultText(trace: Trace) {
  const r = trace.result;
  if (r.kind === "ELEMENT" && r.element) return elementLabel(r.element);
  if (r.kind === "INT") return String(r.intValue);
  if (r.kind === "BOOLEAN") return String(r.booleanValue);
  return r.kind === "RESET" ? "Новая коллекция" : "void";
}

export function metrics(snapshot: ArraySnapshot) {
  return [
    { label: "size", value: snapshot.size, caption: "количество записей" },
    {
      label: "capacity",
      value: snapshot.capacity,
      caption:
        snapshot.capacity === 0 ? "массив не выделен" : "выделенных ячеек",
    },
    {
      label: "free",
      value: snapshot.capacity - snapshot.size,
      caption: "свободных позиций",
    },
    {
      label: "buffer",
      value: `#${snapshot.buffer.id}`,
      caption: "учебная версия массива",
    },
  ];
}

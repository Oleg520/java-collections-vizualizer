import type { Locale } from "./locale";
/** Display metadata only. Java owns catalog order, availability and execution. */
export const scenarioMessages = {
  HASH_MAP: {
    insert: [
      "Обычная вставка",
      "hashCode → spread → индекс → новый узел",
      "Ordinary insertion",
      "hashCode → spread → index → new node",
    ],
    collision: [
      "Коллизия",
      "Три разных ID, один hashCode, одна цепочка",
      "Collision",
      "Three distinct IDs, one hashCode, one chain",
    ],
    update: [
      "Обновление ключа",
      "equals находит ключ; меняется value, но не size",
      "Update a key",
      "equals finds the key; value changes, size does not",
    ],
    resize: [
      "Resize и split",
      "13-я запись: 16 → 32. Бакет 1 делится на 1 и 17",
      "Resize and split",
      "13th entry: 16 → 32. Bucket 1 splits into 1 and 17",
    ],
    treeify: [
      "Красно-чёрное дерево",
      "9 коллизий при capacity = 64; вращения и цвета",
      "Red-black tree",
      "9 collisions at capacity = 64; rotations and colors",
    ],
    "why-no-tree": [
      "Почему нет дерева?",
      "9-я коллизия при capacity = 16 вызывает resize",
      "Why no tree?",
      "9th collision at capacity = 16 triggers resize",
    ],
    "tree-search": [
      "Поиск в дереве",
      "Поиск по hash, equals и Comparable",
      "Tree search",
      "Search using hash, equals and Comparable",
    ],
    "tree-remove": [
      "Удаление из дерева",
      "Балансировка и tree → list по форме дерева",
      "Tree removal",
      "Balancing and tree → list conversion based on tree shape",
    ],
    ...(import.meta.env.DEV
      ? {
          "local-split-6-7": [
            "Локально: split 6/7",
            "Только dev: физические копии L3, проблемный кадр 11",
            "Local: split 6/7",
            "Dev only: physical copies L3, problem frame 11",
          ],
          "local-split-2-7": [
            "Локально: split 2/7",
            "Только dev: физические копии L1, проблемный кадр 11",
            "Local: split 2/7",
            "Dev only: physical copies L1, problem frame 11",
          ],
        }
      : {}),
  },
  ARRAY_LIST: {
    "first-add": [
      "Первое добавление",
      "Стандартный конструктор: 0 → 10",
      "First addition",
      "Default constructor: 0 → 10",
    ],
    "explicit-zero": [
      "Конструктор с нулём",
      "new ArrayList<>(0): 0 → 1",
      "Zero-capacity constructor",
      "new ArrayList<>(0): 0 → 1",
    ],
    growth: [
      "Автоматическое расширение",
      "11-й элемент: 10 → 15; копирование ссылок",
      "Automatic growth",
      "11th element: 10 → 15; reference copying",
    ],
    "insert-middle": [
      "Вставка в середину",
      "add(1, X): сдвиг вправо",
      "Insert in the middle",
      "add(1, X): shift right",
    ],
    "remove-middle": [
      "Удаление из середины",
      "remove(1): сдвиг влево и очистка хвоста",
      "Remove from the middle",
      "remove(1): shift left and clear the tail",
    ],
    "read-replace": [
      "Чтение и замена",
      "get / set: size и capacity прежние",
      "Read and replace",
      "get / set: size and capacity unchanged",
    ],
    nulls: [
      "Настоящий null",
      "Занятые null, строка null и свободные ячейки",
      "Real null",
      "Occupied null, the string null and free slots",
    ],
    capacity: [
      "Управление ёмкостью",
      "ensureCapacity / trimToSize / clear",
      "Capacity management",
      "ensureCapacity / trimToSize / clear",
    ],
    "linear-search": [
      "Линейный поиск",
      "Первое совпадение, дубликаты и −1",
      "Linear search",
      "First match, duplicates and −1",
    ],
  },
} as const;
export function scenarioText(locale: Locale, collection: string, id: string) {
  const catalog = scenarioMessages as Record<
    string,
    Record<string, readonly string[]>
  >;
  const entries = Object.hasOwn(catalog, collection)
    ? catalog[collection]
    : undefined;
  const row = entries && Object.hasOwn(entries, id) ? entries[id] : undefined;
  return row
    ? {
        title: row[locale === "en" ? 2 : 0],
        description: row[locale === "en" ? 3 : 1],
      }
    : {
        title: `${locale === "en" ? "Scenario" : "Сценарий"}: ${id}`,
        description:
          locale === "en" ? "Scenario supplied by Java" : "Сценарий из Java",
      };
}

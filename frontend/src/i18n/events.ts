import type { Step } from "../api/types";
import type { Locale } from "./locale";
type Pair = readonly [string, string];
/** Keys describe Java events/variants, never their human-readable message. */
export const eventMessages = {
  OPERATION_STARTED: ["Начало операции", "Operation started"],
  OPERATION_COMPLETED: [
    "Операция завершена; состояние зафиксировано",
    "Operation completed; state committed",
  ],
  HASH_CALCULATED: [
    "hash = h ^ (h >>> 16); null → 0",
    "hash = h ^ (h >>> 16); null → 0",
  ],
  BUCKET_SELECTED: [
    "(capacity - 1) & hash выбирает бакет",
    "(capacity - 1) & hash selects the bucket",
  ],
  TABLE_ABSENT: [
    "Таблица ещё не выделена; поиск возвращает null",
    "The table is not allocated yet; lookup returns null",
  ],
  KEY_COMPARED: [
    "Ключ не совпал: продолжаем поиск",
    "Key did not match; continue searching",
  ],
  "KEY_COMPARED.found": [
    "Hash и ключ совпали: запись найдена",
    "Hash and key match; entry found",
  ],
  LOOKUP_RESULT: ["Ключ не найден", "Key not found"],
  "LOOKUP_RESULT.found": [
    "Ключ найден; возвращаем значение",
    "Key found; return its value",
  ],
  REMOVE_RESULT: ["Ключ не найден; изменений нет", "Key not found; no changes"],
  "REMOVE_RESULT.found": ["Запись удалена", "Entry removed"],
  MAP_CLEARED: [
    "clear удаляет записи, сохраняя выделенную таблицу",
    "clear removes entries, retaining the allocated table",
  ],
  MAP_RESET: [
    "Новая коллекция: таблица снова выделяется лениво",
    "New collection; the table is allocated lazily again",
  ],
  CONFIGURED: [
    "Конструктор выбран; массив пока не выделен",
    "Constructor selected; the table is not allocated yet",
  ],
  VALUE_UPDATED: [
    "Значение заменено; size не изменяется",
    "Value replaced; size is unchanged",
  ],
  NODE_REMOVED: [
    "Узел удалён, ссылки перестроены",
    "Node removed; links updated",
  ],
  NODE_INSERTED: [
    "В пустой бакет добавлен узел",
    "Node added to an empty bucket",
  ],
  "NODE_INSERTED.CHAIN_APPEND": [
    "Узел добавлен в конец цепочки",
    "Node appended to the chain",
  ],
  "NODE_INSERTED.TREE_INSERT": [
    "Узел присоединён к дереву; начинаем балансировку",
    "Node attached to the tree; begin balancing",
  ],
  COLLISION: [
    "Бакет занят другим ключом; идём по цепочке",
    "Bucket contains another key; follow the chain",
  ],
  SIZE_CHANGED: ["Новый ключ увеличивает size", "A new key increases size"],
  THRESHOLD_EXCEEDED: [
    "size > threshold: требуется resize",
    "size > threshold; resize required",
  ],
  RESIZE_STARTED: [
    "Удваиваем таблицу и делим бакеты по hash & oldCapacity",
    "Double the table; split buckets using hash & oldCapacity",
  ],
  TABLE_INITIALIZED: [
    "Таблица выделена при первой вставке",
    "Table allocated on the first insertion",
  ],
  TABLE_EXPANDED: [
    "Новая таблица выделена; старые бакеты ждут переноса",
    "New table allocated; old buckets await transfer",
  ],
  BUCKET_SPLIT: [
    "hash & oldCapacity: узел остаётся или переходит на +oldCapacity",
    "hash & oldCapacity: keep the index or add oldCapacity",
  ],
  RESIZE_COMPLETED: [
    "Перенос завершён; порядок внутри половин сохранён",
    "Transfer completed; order within each partition preserved",
  ],
  TREEIFY_DEFERRED: [
    "Длинная цепочка, но capacity < 64: resize вместо дерева",
    "Long chain, but capacity < 64; resize instead of treeification",
  ],
  TREEIFY_STARTED: [
    "Не менее 9 узлов и capacity ≥ 64: строим красно-чёрное дерево",
    "At least 9 nodes and capacity ≥ 64; build a red-black tree",
  ],
  TREEIFY_COMPLETED: [
    "Бакет стал красно-чёрным деревом",
    "Bucket converted to a red-black tree",
  ],
  TREE_VISITED: [
    "Сравниваем hash, equals и Comparable в узле дерева",
    "Compare hash, equals and Comparable at the tree node",
  ],
  TREE_DIRECTION: ["Выбрана ветвь дерева", "Tree branch selected"],
  "TREE_DIRECTION.SEARCH": [
    "Comparable определяет ветвь поиска",
    "Comparable determines the search branch",
  ],
  "TREE_DIRECTION.TREEIFY": [
    "Выбрана ветвь для узла при treeify",
    "Branch selected for the node during treeification",
  ],
  "TREE_DIRECTION.INSERT": [
    "Выбрана ветвь вставки по hash и Comparable",
    "Insertion branch selected by hash and Comparable",
  ],
  TREE_BALANCED: [
    "Свойства красно-чёрного дерева восстановлены",
    "Red-black tree properties restored",
  ],
  TREE_ROTATED: ["Левое вращение вокруг узла", "Left rotation around the node"],
  "TREE_ROTATED.RIGHT": [
    "Правое вращение вокруг узла",
    "Right rotation around the node",
  ],
  TREE_RECOLORED: ["Цвета дерева обновлены", "Tree colors updated"],
  "TREE_RECOLORED.NEW_NODE": [
    "Новый узел окрашен в красный",
    "New node colored red",
  ],
  "TREE_RECOLORED.ROOT_BLACK": [
    "Корень окрашен в чёрный",
    "Root colored black",
  ],
  "TREE_RECOLORED.RED_UNCLE": [
    "Красный дядя: родитель и дядя чёрные, дед красный",
    "Red uncle: parent and uncle become black, grandparent red",
  ],
  UNTREEIFIED: ["Бакет преобразован в список", "Bucket converted to a list"],
  "UNTREEIFIED.REMOVAL_SHAPE": [
    "Форма дерева мала: root.right / root.left / root.left.left отсутствует",
    "Small tree shape: root.right / root.left / root.left.left is missing",
  ],
  "UNTREEIFIED.SPLIT_COUNT": [
    "После split в половине ≤ 6 узлов: список",
    "After splitting, a partition has ≤ 6 nodes; use a list",
  ],
  INDEX_CHECKED: ["Индекс допустим", "Index is valid"],
  CAPACITY_CHECKED: [
    "Проверка места для новой ссылки",
    "Check space for a new reference",
  ],
  "CAPACITY_CHECKED.ENSURE_CAPACITY": [
    "Default-empty и minCapacity ≤ 10: выделение не требуется; отрицательный minCapacity — no-op",
    "Default-empty and minCapacity ≤ 10: no allocation required; negative minCapacity is a no-op",
  ],
  "CAPACITY_CHECKED.TRIM_TO_SIZE": [
    "Ёмкость уже равна size; буфер и пустой маркер сохранены",
    "Capacity already equals size; buffer and empty marker retained",
  ],
  ELEMENTS_SHIFTED_RIGHT: [
    "Эффект одного System.arraycopy: диапазон сдвинут вправо",
    "Effect of one System.arraycopy: range shifted right",
  ],
  ELEMENTS_SHIFTED_LEFT: [
    "Эффект одного System.arraycopy: хвост сдвинут влево",
    "Effect of one System.arraycopy: tail shifted left",
  ],
  ELEMENT_WRITTEN: ["Новая ссылка записана", "New reference written"],
  ELEMENT_READ: ["Прямой доступ по индексу", "Direct access by index"],
  ELEMENT_REPLACED: [
    "Заменена ссылка; size и capacity прежние",
    "Reference replaced; size and capacity unchanged",
  ],
  TAIL_CLEARED: [
    "Последняя ссылка очищена, size уменьшен",
    "Last reference cleared; size decreased",
  ],
  ELEMENT_COMPARED: [
    "Сравнение слева направо: null или equals",
    "Compare left to right using null or equals",
  ],
  ELEMENT_FOUND: ["Найдено первое вхождение", "First occurrence found"],
  ELEMENT_NOT_FOUND: ["Значение не найдено: −1", "Value not found: −1"],
  LIST_CLEARED: [
    "Все ссылки очищены; capacity сохранена",
    "All references cleared; capacity retained",
  ],
  LIST_RESET: [
    "Учебный reset: новая структура с выбранным конструктором",
    "Teaching reset: new structure using the selected constructor",
  ],
  ARRAY_ALLOCATED: [
    "Подготовлен другой буфер elementData",
    "Another elementData buffer allocated",
  ],
  ARRAY_COPY_STARTED: [
    "Копируются ссылки, объекты не клонируются",
    "Copy references; objects are not cloned",
  ],
  ARRAY_COPY_COMPLETED: [
    "Ссылки перенесены в новый буфер",
    "References copied to the new buffer",
  ],
  CAPACITY_GROWN: [
    "elementData переключён на новый буфер",
    "elementData switched to the new buffer",
  ],
  CAPACITY_RESERVED: [
    "elementData переключён на новый буфер",
    "elementData switched to the new buffer",
  ],
  CAPACITY_TRIMMED: [
    "elementData переключён на новый буфер",
    "elementData switched to the new buffer",
  ],
} satisfies Record<string, Pair>;
export function eventExplanation(locale: Locale, step: Step): string {
  const d = step.details;
  const variant =
    step.event === "KEY_COMPARED"
      ? d.equal
        ? "found"
        : ""
      : step.event === "LOOKUP_RESULT" || step.event === "REMOVE_RESULT"
        ? d.found
          ? "found"
          : ""
        : step.event === "TREE_ROTATED"
          ? d.direction
          : step.event === "TREE_RECOLORED" || step.event === "UNTREEIFIED"
            ? d.reason
            : step.event === "TREE_DIRECTION" || step.event === "NODE_INSERTED"
              ? d.context
              : step.event === "CAPACITY_CHECKED"
                ? step.operation.type
                : "";
  const messages: Record<string, Pair> = eventMessages;
  const pair =
    messages[`${step.event}.${String(variant)}`] ?? messages[step.event];
  return pair
    ? pair[locale === "en" ? 1 : 0]
    : locale === "en"
      ? `Java event: ${step.event}`
      : `Событие Java: ${step.event}`;
}

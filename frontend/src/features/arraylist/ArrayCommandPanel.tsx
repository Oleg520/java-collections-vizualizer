import { useState, type FormEvent } from "react";
import type {
  ArrayCommand,
  Element,
  Operation,
  Session,
} from "../../api/types/index";

const commands: [ArrayCommand, string][] = [
  ["ADD", "add(E)"],
  ["ADD_AT", "add(index, E)"],
  ["GET_AT", "get(index)"],
  ["SET_AT", "set(index, E)"],
  ["REMOVE_AT", "remove(index)"],
  ["INDEX_OF", "indexOf(E)"],
  ["ENSURE_CAPACITY", "ensureCapacity(n)"],
  ["TRIM_TO_SIZE", "trimToSize()"],
  ["CLEAR", "clear()"],
  ["RESET", "reset · новая структура"],
];
export function ArrayCommandPanel({
  busy,
  session,
  onCommand,
  onError,
  onCreate,
}: {
  busy: boolean;
  session: Session | null;
  onCommand: (op: Operation) => void;
  onError: (error: string) => void;
  onCreate: (capacity?: number) => void;
}) {
  const [mode, setMode] = useState<ArrayCommand>("ADD");
  const [type, setType] = useState<Element["type"]>("STRING");
  const [value, setValue] = useState("A");
  const [index, setIndex] = useState("0");
  const [minimum, setMinimum] = useState("20");
  const [constructor, setConstructor] = useState("default");
  const indexed = ["ADD_AT", "GET_AT", "SET_AT", "REMOVE_AT"].includes(mode);
  const valued = ["ADD", "ADD_AT", "SET_AT", "INDEX_OF"].includes(mode);
  const int = (s: string) =>
    /^-?\d+$/.test(s) && Number(s) >= -2147483648 && Number(s) <= 2147483647;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (
      (indexed && !int(index)) ||
      (valued && type === "INTEGER" && !int(value)) ||
      (mode === "ENSURE_CAPACITY" && !int(minimum))
    ) {
      onError("Введите целое число в диапазоне Java int.");
      return;
    }
    onCommand({
      type: mode,
      key: null,
      value: null,
      ...(indexed ? { index: Number(index) } : {}),
      ...(valued
        ? { element: { type, value: type === "NULL" ? null : value } }
        : {}),
      ...(mode === "ENSURE_CAPACITY" ? { minCapacity: Number(minimum) } : {}),
    });
  };
  return (
    <section
      className="command-panel panel"
      aria-label="Панель операций ArrayList"
    >
      <div className="command-topline array-constructor">
        <span className="eyebrow">ARRAYLIST · OBJECT[]</span>
        <label>
          Конструктор{" "}
          <select
            aria-label="Конструктор ArrayList"
            value={constructor}
            onChange={(e) => setConstructor(e.target.value)}
          >
            <option value="default">new ArrayList&lt;&gt;()</option>
            {[0, 1, 5, 10, 16, 128, 256].map((n) => (
              <option key={n} value={n}>
                new ArrayList&lt;&gt;({n})
              </option>
            ))}
          </select>
        </label>
        <button
          className="subtle-button"
          disabled={busy}
          onClick={() =>
            onCreate(
              constructor === "default" ? undefined : Number(constructor),
            )
          }
        >
          Создать список
        </button>
      </div>
      <form className="command-form array-command-form" onSubmit={submit}>
        <label className="field">
          <span>Операция</span>
          <select
            aria-label="Операция"
            value={mode}
            onChange={(e) => setMode(e.target.value as ArrayCommand)}
          >
            {commands.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {indexed && (
          <label className="field">
            <span>Индекс</span>
            <input
              aria-label="Индекс"
              value={index}
              inputMode="numeric"
              onChange={(e) => setIndex(e.target.value)}
            />
          </label>
        )}
        {valued && (
          <>
            <label className="field">
              <span>Тип элемента</span>
              <select
                aria-label="Тип элемента"
                value={type}
                onChange={(e) => setType(e.target.value as Element["type"])}
              >
                <option value="STRING">String</option>
                <option value="INTEGER">Integer</option>
                <option value="NULL">null</option>
              </select>
            </label>
            {type !== "NULL" && (
              <label className="field">
                <span>Элемент</span>
                <input
                  aria-label="Элемент"
                  value={value}
                  maxLength={128}
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
            )}
          </>
        )}
        {mode === "ENSURE_CAPACITY" && (
          <label className="field">
            <span>minCapacity</span>
            <input
              aria-label="minCapacity"
              value={minimum}
              inputMode="numeric"
              onChange={(e) => setMinimum(e.target.value)}
            />
          </label>
        )}
        <button
          type="submit"
          className="primary-button"
          disabled={busy || !session}
        >
          Выполнить {commands.find(([id]) => id === mode)?.[1]}
        </button>
      </form>
      <div className="input-caption">
        {mode === "REMOVE_AT"
          ? "remove(int index) возвращает элемент; это удаление по индексу."
          : mode === "RESET"
            ? "Учебный reset восстанавливает конструктор текущей сессии. clear сохраняет capacity."
            : "String, Integer и null различаются. ID обозначает вхождение, а не адрес Java-объекта."}
      </div>
    </section>
  );
}

import { useState, type FormEvent, type ReactNode } from "react";
import { LoaderCircle, Play, RotateCcw, Terminal, Trash2 } from "lucide-react";
import type {
  CommandType,
  KeySpec,
  KeyType,
  Operation,
  Session,
} from "../../api/types/index";
export function CommandPanel({
  metrics,
  busy,
  blocked = false,
  session,
  onCommand,
  onError: setError,
}: {
  metrics: ReactNode;
  busy: boolean;
  blocked?: boolean;
  session: Session | null;
  onCommand: (operation: Operation) => void;
  onError: (message: string) => void;
}) {
  const [mode, setMode] = useState<"PUT" | "GET" | "REMOVE">("PUT");
  const [keyType, setKeyType] = useState<KeyType>("STRING");
  const [key, setKey] = useState("Java");
  const [value, setValue] = useState("Hello");
  const [nullValue, setNullValue] = useState(false);
  const [hash, setHash] = useState("42");
  const command = (type: CommandType, keySpec: KeySpec | null = null) => {
    onCommand({
      type,
      key: keySpec,
      value: type === "PUT" && !nullValue ? value : null,
    });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    let parsedHash: number | null = null;
    if (keyType === "COLLISION") {
      if (!validInt(hash)) {
        setError("hashCode должен быть целым числом в диапазоне Java int.");
        return;
      }
      if (!key.trim()) {
        setError("Введите ID учебного ключа.");
        return;
      }
      parsedHash = Number(hash);
    }
    if (keyType === "INTEGER" && !validInt(key)) {
      setError("Введите целое число в диапазоне Java Integer.");
      return;
    }
    command(mode, {
      type: keyType,
      value: keyType === "NULL" ? null : key,
      hashCodeOverride: parsedHash,
    });
  };

  return (
    <section
      className="workbench-controls command-panel panel"
      aria-label="Панель операций"
    >
      <div className="controls-top">{metrics}</div>
      <form onSubmit={submit} className="command-form">
        <div className="field operation-field">
          <span>Операция</span>
          <div className="operation-tabs">
            {(["PUT", "GET", "REMOVE"] as const).map((t) => (
              <button
                type="button"
                key={t}
                className={mode === t ? "active" : ""}
                onClick={() => setMode(t)}
                aria-pressed={mode === t}
              >
                {t.toLowerCase()}
                <span>()</span>
              </button>
            ))}
          </div>
        </div>
        <label className="field key-type">
          <span>Тип ключа</span>
          <select
            value={keyType}
            onChange={(e) => setKeyType(e.target.value as KeyType)}
          >
            <option value="STRING">String</option>
            <option value="INTEGER">Integer</option>
            <option value="COLLISION">Учебный · hashCode</option>
            <option value="NULL">null</option>
          </select>
        </label>
        <label className="field">
          <span>
            {keyType === "COLLISION" ? "ID ключа" : "Ключ"} <code>key</code>
          </span>
          <input
            aria-label="Ключ"
            value={keyType === "NULL" ? "null" : key}
            onChange={(e) => setKey(e.target.value)}
            disabled={keyType === "NULL"}
            maxLength={64}
            placeholder="Java"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {keyType === "COLLISION" && (
          <label className="field hash-field">
            <span>
              hashCode <code>int</code>
            </span>
            <input
              aria-label="hashCode"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              inputMode="numeric"
              maxLength={11}
            />
          </label>
        )}
        {mode === "PUT" && (
          <label className="field">
            <span>
              Значение <code>value</code>
            </span>
            <input
              aria-label="Значение"
              value={nullValue ? "null" : value}
              disabled={nullValue}
              onChange={(e) => setValue(e.target.value)}
              maxLength={128}
              placeholder="Hello"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        )}
        <button
          className="primary-button"
          aria-label={`Выполнить ${mode.toLowerCase()}`}
          type="submit"
          disabled={busy || blocked || !session}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Play size={15} fill="currentColor" />
          )}{" "}
          Выполнить
        </button>
      </form>
      <div className="input-caption">
        <span>
          <Terminal size={12} />
          {keyType === "COLLISION"
            ? "TeachingKey: разные ID могут иметь один hashCode. Порядок в дереве — по ID."
            : keyType === "NULL"
              ? "Единственный null-ключ имеет hash = 0."
              : `${keyType}: настоящий Java ${keyType}. Хеш вычисляется на сервере.`}
        </span>
        {mode === "PUT" && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={nullValue}
              onChange={(e) => setNullValue(e.target.checked)}
            />{" "}
            value = null
          </label>
        )}
        <div className="reset-actions">
          <button
            className="subtle-button"
            onClick={() => command("CLEAR")}
            disabled={busy || blocked || !session}
            title="clear сохраняет массив бакетов"
          >
            <Trash2 size={13} />
            <span>clear</span>
          </button>
          <button
            className="subtle-button"
            onClick={() => command("RESET")}
            disabled={busy || blocked || !session}
          >
            <RotateCcw size={13} /> Начать заново
          </button>
        </div>
      </div>
    </section>
  );
}
function validInt(value: string) {
  return (
    /^-?\d+$/.test(value) &&
    Number(value) >= -2147483648 &&
    Number(value) <= 2147483647
  );
}

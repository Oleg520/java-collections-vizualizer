import type { Message } from "../../i18n/errors";
import { useI18n } from "../../i18n/LocaleProvider";
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
  onError: (message: Message) => void;
}) {
  const { t } = useI18n();
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
        setError({
          key: "hashmap.CommandPanel.hashcode_must_be_a_whole_number",
        });
        return;
      }
      if (!key.trim()) {
        setError({ key: "hashmap.CommandPanel.enter_a_teaching_key_id" });
        return;
      }
      parsedHash = Number(hash);
    }
    if (keyType === "INTEGER" && !validInt(key)) {
      setError({ key: "hashmap.CommandPanel.enter_a_whole_number_within_the" });
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
      aria-label={t("hashmap.CommandPanel.operations")}
    >
      <div className="controls-top">{metrics}</div>
      <form onSubmit={submit} className="command-form">
        <label className="field">
          <span>{t("arraylist.ArrayCommandPanel.operation")}</span>
          <select
            aria-label={t("arraylist.ArrayCommandPanel.operation")}
            value={mode}
            onChange={(event) => setMode(event.target.value as typeof mode)}
          >
            <option value="PUT">put(K, V)</option>
            <option value="GET">get(K)</option>
            <option value="REMOVE">remove(K)</option>
          </select>
        </label>
        <label className="field key-type">
          <span>{t("hashmap.CommandPanel.key_type")}</span>
          <select
            value={keyType}
            onChange={(e) => setKeyType(e.target.value as KeyType)}
          >
            <option value="STRING">String</option>
            <option value="INTEGER">Integer</option>
            <option value="COLLISION">
              {t("hashmap.CommandPanel.teaching_key_hashcode")}
            </option>
            <option value="NULL">null</option>
          </select>
        </label>
        <label className="field">
          <span>
            {keyType === "COLLISION"
              ? t("hashmap.CommandPanel.key_id")
              : t("hashmap.CommandPanel.key")}{" "}
            <code>key</code>
          </span>
          <input
            aria-label={t("hashmap.CommandPanel.key")}
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
              {t("hashmap.CommandPanel.value")} <code>value</code>
            </span>
            <input
              aria-label={t("hashmap.CommandPanel.value")}
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
          aria-label={t("arraylist.ArrayCommandPanel.execute", {
            "0": mode.toLowerCase(),
          })}
          type="submit"
          disabled={busy || blocked || !session}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Play size={15} fill="currentColor" />
          )}{" "}
          {t("arraylist.ArrayCommandPanel.execute_button")}
        </button>
      </form>
      <div className="input-caption">
        <span>
          <Terminal size={12} />
          {keyType === "COLLISION"
            ? t("hashmap.CommandPanel.teachingkey_distinct_ids_can_have_the")
            : keyType === "NULL"
              ? t("hashmap.CommandPanel.the_single_null_key_has_hash")
              : t("hashmap.CommandPanel.a_real_java_hash_is_computed", {
                  "0": keyType,
                  "1": keyType,
                })}
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
            title={t("hashmap.CommandPanel.clear_retains_the_bucket_array")}
          >
            <Trash2 size={13} />
            <span>clear</span>
          </button>
          <button
            className="subtle-button"
            onClick={() => command("RESET")}
            disabled={busy || blocked || !session}
          >
            <RotateCcw size={13} /> {t("hashmap.CommandPanel.start_over")}
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

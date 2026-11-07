import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Braces,
  Check,
  ChevronRight,
  Code2,
  GitBranch,
  Github,
  Info,
  Layers,
  LoaderCircle,
  Network,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { api, ApiError } from "./api";
import { Diagram } from "./Diagram";
import {
  keyLabel,
  operationLabel,
  valueLabel,
  type CommandType,
  type KeySpec,
  type KeyType,
  type MapNode,
  type Operation,
  type Scenario,
  type Session,
  type SessionTrace,
  type Step,
  type Trace,
} from "./types";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [history, setHistory] = useState<Trace[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"PUT" | "GET" | "REMOVE">("PUT");
  const [keyType, setKeyType] = useState<KeyType>("STRING");
  const [key, setKey] = useState("Java");
  const [value, setValue] = useState("Hello");
  const [nullValue, setNullValue] = useState(false);
  const [hash, setHash] = useState("42");
  const [tab, setTab] = useState<"events" | "algorithm">("events");
  const [selectedNodeId, setSelectedNodeId] = useState<number>();
  const eventRef = useRef<HTMLButtonElement>(null);
  const trace = history[historyIndex];
  const step = trace?.steps[cursor];
  const snapshot = step?.snapshot ?? session?.state;
  const selectedNode = snapshot
    ? [...snapshot.buckets, ...snapshot.pendingBuckets]
        .flatMap((b) => b.nodes)
        .find((n) => n.id === selectedNodeId)
    : undefined;

  const startSession = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setPlaying(false);
    try {
      const [newSession, demos] = await Promise.all([
        api.create(),
        api.scenarios(),
      ]);
      setSession(newSession);
      setScenarios(demos);
      setHistory([]);
      setHistoryIndex(-1);
      setCursor(0);
      setSelectedNodeId(undefined);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    void startSession();
  }, []);
  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return;
    }
    const timeout = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(timeout);
  }, [busy]);
  useEffect(() => {
    if (!playing || !trace) return;
    if (cursor >= trace.steps.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(
      () => setCursor((n) => Math.min(n + 1, trace.steps.length - 1)),
      1000 / speed,
    );
    return () => clearTimeout(timer);
  }, [playing, trace, cursor, speed]);
  useEffect(() => {
    const row = eventRef.current,
      list = row?.parentElement;
    if (!row || !list) return;
    const r = row.getBoundingClientRect(),
      l = list.getBoundingClientRect();
    if (r.top < l.top) list.scrollTop -= l.top - r.top;
    else if (r.bottom > l.bottom) list.scrollTop += r.bottom - l.bottom;
  }, [cursor, historyIndex, tab]);

  const execute = async (request: () => Promise<SessionTrace>) => {
    if (busyRef.current || !session) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setPlaying(false);
    try {
      const response = await request();
      setSession({
        ...session,
        revision: response.revision,
        state: response.trace.committed,
      });
      setHistory((prev) => [...prev.slice(-11), response.trace]);
      setHistoryIndex(Math.min(history.length, 11));
      setCursor(0);
      setPlaying(true);
      setSelectedNodeId(undefined);
    } catch (e) {
      setError(errorMessage(e));
      // Never retry a mutating command: a lost response may still have committed.
      if (e instanceof ApiError && (e.status === 409 || e.status === 0)) {
        try {
          setSession(await api.get(session.id));
          setHistoryIndex(-1);
          setCursor(0);
        } catch {
          /* Preserve the original actionable error; explicit recovery is available. */
        }
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const command = (type: CommandType, keySpec: KeySpec | null = null) => {
    if (!session) return;
    const operation: Operation = {
      type,
      key: keySpec,
      value: type === "PUT" && !nullValue ? value : null,
    };
    void execute(() => api.command(session, operation));
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
  const navigate = (index: number) => {
    setPlaying(false);
    setCursor(Math.max(0, Math.min(index, (trace?.steps.length ?? 1) - 1)));
  };
  const togglePlay = () => {
    if (!trace) return;
    if (cursor === trace.steps.length - 1) setCursor(0);
    setPlaying((p) => !p);
  };
  const demo = (name: string) => {
    if (session) void execute(() => api.scenario(session, name));
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="Java Collections Visualizer">
          <span className="brand-mark">
            <Network size={23} />
          </span>
          <span>
            Collections<span className="brand-suffix"> / visualizer</span>
          </span>
          <span className="version">v0.1</span>
        </a>
        <div className="header-right">
          <span className={`connection ${session ? "online" : ""}`}>
            <i />
            {busy
              ? "Java выполняет…"
              : session
                ? "Java engine connected"
                : "Подключение к Java"}
          </span>
          <a
            className="repo-link"
            href="https://github.com/Oleg520/java-collections-vizualizer"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Исходный код проекта на GitHub"
            title="Исходный код проекта на GitHub"
          >
            <Github size={15} />
            <span>GitHub</span>
            <ArrowUpRight size={14} />
          </a>
          <a
            href="https://github.com/openjdk/jdk21u/blob/master/src/java.base/share/classes/java/util/HashMap.java"
            target="_blank"
            rel="noreferrer"
          >
            OpenJDK 21 <ArrowUpRight size={14} />
          </a>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-section">
            <span className="eyebrow">КОЛЛЕКЦИЯ</span>
            <label className="sr-only" htmlFor="collection">
              Коллекция
            </label>
            <div className="collection-selector">
              <Braces size={19} />
              <select id="collection" defaultValue="HASH_MAP">
                <option value="HASH_MAP">HashMap</option>
              </select>
              <span>01</span>
            </div>
            <p className="sidebar-note">
              Java Collections Framework
              <br />
              Интерактивная лаборатория
            </p>
          </div>
          <div className="sidebar-section scenarios">
            <div className="sidebar-title">
              <span className="eyebrow">ГОТОВЫЕ СЦЕНАРИИ</span>
              <BookOpen size={14} />
            </div>
            <p className="sidebar-description">
              Один запуск — весь путь алгоритма.
            </p>
            {scenarios.map((s, i) => (
              <button
                key={s.id}
                className={`scenario-button ${trace?.operation.value === s.id && trace.operation.type === "SCENARIO" ? "selected" : ""}`}
                onClick={() => demo(s.id)}
                disabled={busy || !session}
                title={s.description}
              >
                <span className="scenario-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{s.title}</strong>
                  <small>{s.description}</small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
            <p className="scenario-reset-note">
              <RotateCcw size={12} /> Каждый сценарий начинает с пустой
              коллекции.
            </p>
          </div>
          <div className="sidebar-bottom">
            <div className="java-badge">
              J<span>21</span>
            </div>
            <p>
              Алгоритм живёт в Java.
              <br />
              <span>Здесь вы видите каждый шаг.</span>
            </p>
          </div>
        </aside>
        <main>
          <div className="page-heading">
            <div>
              <div className="breadcrumbs">
                Collections <ChevronRight size={12} /> Map{" "}
                <ChevronRight size={12} /> <span>HashMap</span>
              </div>
              <h1>
                Понять, что внутри<span>.</span>
              </h1>
              <p>Добавляйте ключи. Следите за связями. Исследуйте алгоритм.</p>
            </div>
            <div className="model-badge">
              <GitBranch size={16} />
              <div>
                Учебная модель<span>по алгоритмам OpenJDK 21</span>
              </div>
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <Info size={18} />
              <span>{error}</span>
              <button onClick={() => void startSession()} disabled={busy}>
                Новая сессия
              </button>
              <button
                className="icon-button"
                aria-label="Закрыть ошибку"
                onClick={() => setError(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {slow && (
            <div className="loading-banner" role="status">
              <LoaderCircle size={16} className="spin" /> Ожидаем Java-сервис.
              При холодном запуске это может занять до минуты.
            </div>
          )}
          <section className="command-panel panel" aria-label="Панель операций">
            <div className="command-topline">
              <div className="operation-tabs">
                {(["PUT", "GET", "REMOVE"] as const).map((t) => (
                  <button
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
              <div className="reset-actions">
                <button
                  className="subtle-button"
                  onClick={() => command("CLEAR")}
                  disabled={busy || !session}
                  title="clear сохраняет массив бакетов"
                >
                  <Trash2 size={13} />
                  <span>clear</span>
                </button>
                <button
                  className="subtle-button"
                  onClick={() => command("RESET")}
                  disabled={busy || !session}
                >
                  <RotateCcw size={13} /> Начать заново
                </button>
              </div>
            </div>
            <form onSubmit={submit} className="command-form">
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
                  {keyType === "COLLISION" ? "ID ключа" : "Ключ"}{" "}
                  <code>key</code>
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
                type="submit"
                disabled={busy || !session}
              >
                {busy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Play size={15} fill="currentColor" />
                )}{" "}
                Выполнить {mode.toLowerCase()}
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
            </div>
          </section>
          <div className="state-label">
            <span>
              <i
                className={
                  snapshot?.phase === "WORKING"
                    ? "working-dot"
                    : "committed-dot"
                }
              />
              {snapshot?.phase === "WORKING"
                ? "Рабочий снимок шага"
                : "Зафиксированное состояние"}
            </span>
            {session && (
              <span>
                На сервере: size{" "}
                <b data-testid="committed-size">{session.state.size}</b> ·
                revision {session.revision}
              </span>
            )}
          </div>
          <section className="metrics" aria-label="Показатели состояния">
            <Metric
              label="size"
              value={snapshot?.size ?? "—"}
              caption="количество записей"
            />
            <Metric
              label="capacity"
              value={snapshot?.capacity ?? "—"}
              caption={
                snapshot?.capacity === 0
                  ? "массив не выделен"
                  : "выделенных бакетов"
              }
            />
            <Metric
              label="threshold"
              value={snapshot?.threshold ?? "—"}
              caption={
                snapshot?.capacity === 0 && snapshot.threshold > 0
                  ? "целевая начальная ёмкость"
                  : "resize при size > threshold"
              }
            />
            <Metric
              label="loadFactor"
              value={snapshot?.loadFactor ?? ".75"}
              caption="коэффициент загрузки"
            />
            <div className="metric result-metric">
              <span>РЕЗУЛЬТАТ ОПЕРАЦИИ</span>
              <strong data-testid="operation-result">
                {trace ? resultText(trace) : "Готов к работе"}
              </strong>
              <small>
                {trace
                  ? trace.result.found
                    ? "ключ найден в коллекции"
                    : "операция выполнена Java-движком"
                  : "начните с put или сценария"}
              </small>
            </div>
          </section>
          <div className="lab-grid">
            <div className="canvas-column">
              {snapshot ? (
                <Diagram
                  state={snapshot}
                  step={step}
                  selectedId={selectedNodeId}
                  onSelect={(n) =>
                    setSelectedNodeId(
                      n.id === selectedNodeId ? undefined : n.id,
                    )
                  }
                />
              ) : (
                <div className="panel connecting">
                  <LoaderCircle className="spin" />
                  <h2>Подключаем Java-движок</h2>
                  <p>Состояние коллекции появится после создания сессии.</p>
                </div>
              )}
              <section
                className="playback panel"
                aria-label="Управление воспроизведением"
              >
                <div className="playback-top">
                  <div className="transport">
                    <button
                      className="icon-button"
                      aria-label="В начало"
                      disabled={!trace}
                      onClick={() => navigate(0)}
                    >
                      <SkipBack size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Шаг назад"
                      disabled={!trace || cursor === 0}
                      onClick={() => navigate(cursor - 1)}
                    >
                      <StepBack size={19} />
                    </button>
                    <button
                      className="play-button"
                      aria-label={playing ? "Пауза" : "Воспроизвести"}
                      disabled={!trace}
                      onClick={togglePlay}
                    >
                      {playing ? (
                        <Pause size={17} fill="currentColor" />
                      ) : (
                        <Play size={17} fill="currentColor" />
                      )}
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Шаг вперёд"
                      disabled={!trace || cursor === trace.steps.length - 1}
                      onClick={() => navigate(cursor + 1)}
                    >
                      <StepForward size={19} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="В конец"
                      disabled={!trace}
                      onClick={() => navigate((trace?.steps.length ?? 1) - 1)}
                    >
                      <SkipForward size={17} />
                    </button>
                  </div>
                  <div className="step-counter">
                    ШАГ{" "}
                    <b data-testid="step-number">{trace ? cursor + 1 : 0}</b>
                    <span>/ {trace?.steps.length ?? 0}</span>
                  </div>
                  <label className="speed-control">
                    <span>Скорость</span>
                    <select
                      aria-label="Скорость воспроизведения"
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                    >
                      {[0.5, 1, 2, 4].map((s) => (
                        <option key={s} value={s}>
                          {s}×
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <input
                  aria-label="Позиция воспроизведения"
                  className="timeline"
                  type="range"
                  min="0"
                  max={Math.max(1, (trace?.steps.length ?? 1) - 1)}
                  value={cursor}
                  onChange={(e) => navigate(Number(e.target.value))}
                  disabled={!trace}
                />
                <div className="step-explanation">
                  <span className="step-symbol">
                    {step?.event === "OPERATION_COMPLETED" ? (
                      <Check size={16} />
                    ) : (
                      <ArrowRight size={16} />
                    )}
                  </span>
                  <div>
                    <strong>
                      {step?.message ?? "Операции превращаются в понятные шаги"}
                    </strong>
                    <code>
                      {step?.details.formula
                        ? String(step.details.formula)
                        : step
                          ? `${step.event} · ${operationLabel(step.operation)}`
                          : "Воспроизведение управляет временем, а не состоянием Java-коллекции."}
                    </code>
                  </div>
                </div>
              </section>
              <div className="history-bar">
                <Layers size={14} />
                <label htmlFor="history">История операций</label>
                <select
                  id="history"
                  value={historyIndex}
                  onChange={(e) => {
                    setHistoryIndex(Number(e.target.value));
                    setCursor(0);
                    setPlaying(false);
                    setSelectedNodeId(undefined);
                  }}
                >
                  <option value="-1">Текущее состояние сервера</option>
                  {history.map((t, i) => (
                    <option key={i} value={i}>
                      {i + 1}. {operationLabel(t.operation)}
                    </option>
                  ))}
                </select>
                <span>последние 12</span>
              </div>
            </div>
            <aside className="inspector panel" aria-label="Алгоритм и события">
              <div className="inspector-tabs">
                <button
                  className={tab === "events" ? "active" : ""}
                  onClick={() => setTab("events")}
                >
                  <Terminal size={14} /> Events{" "}
                  <span>{trace?.steps.length ?? 0}</span>
                </button>
                <button
                  className={tab === "algorithm" ? "active" : ""}
                  onClick={() => setTab("algorithm")}
                >
                  <Code2 size={14} /> Algorithm
                </button>
              </div>
              <div className="inspector-title">
                <span className="eyebrow">
                  {tab === "events" ? "EXECUTION TRACE" : "СЕМАНТИЧЕСКИЕ ЭТАПЫ"}
                </span>
                <span className="live-label">
                  {playing ? "PLAYING" : "PAUSED"}
                </span>
              </div>
              {tab === "events" ? (
                <div className="event-list">
                  {trace ? (
                    trace.steps.map((s, i) => (
                      <button
                        ref={i === cursor ? eventRef : undefined}
                        className={`event-row ${i === cursor ? "current" : ""} ${i < cursor ? "past" : ""}`}
                        key={i}
                        onClick={() => navigate(i)}
                        aria-current={i === cursor ? "step" : undefined}
                      >
                        <span className="event-order">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>
                          <code>{s.event}</code>
                          <small>{s.message}</small>
                        </span>
                        {i === cursor && <ChevronRight size={13} />}
                      </button>
                    ))
                  ) : (
                    <div className="inspector-empty">
                      <Terminal size={25} />
                      <p>Trace ещё пуст</p>
                      <small>
                        Здесь появятся события реального выполнения операции.
                      </small>
                    </div>
                  )}
                </div>
              ) : (
                <div className="algorithm-list">
                  <p>
                    Схема этапов, не исполняемый код. Активный этап приходит из
                    Java trace.
                  </p>
                  {algorithm.map(([stage, code, note]) => (
                    <div
                      key={stage}
                      className={step?.stage === stage ? "active" : ""}
                    >
                      <code>{code}</code>
                      <small>{note}</small>
                    </div>
                  ))}
                  <a
                    href="https://github.com/openjdk/jdk21u/blob/master/src/java.base/share/classes/java/util/HashMap.java"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Исходник OpenJDK <ArrowUpRight size={12} />
                  </a>
                </div>
              )}
              <div className="technical-details">
                <span className="eyebrow">
                  {selectedNode
                    ? `NODE #${selectedNode.id}`
                    : "ТЕХНИЧЕСКИЕ ДЕТАЛИ"}
                </span>
                {selectedNode ? (
                  <NodeDetails
                    node={selectedNode}
                    onClose={() => setSelectedNodeId(undefined)}
                  />
                ) : step ? (
                  <>
                    <div className="step-op">
                      {operationLabel(step.operation)}
                    </div>
                    <dl>
                      {Object.entries(step.details).map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v === null ? "null" : String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                    {Object.keys(step.details).length === 0 && (
                      <p>Этап: {step.stage}</p>
                    )}
                  </>
                ) : (
                  <p>
                    Формулы, сравнения и ссылки узлов появятся вместе с trace.
                  </p>
                )}
              </div>
            </aside>
          </div>
          <footer className="page-footer">
            <span>
              <Braces size={13} /> Java — источник истины. React —
              представление.
            </span>
            <span>128 элементов / сессия · шаги доступны без соединения</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  caption,
}: {
  label: string;
  value: string | number;
  caption: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong data-testid={`metric-${label}`}>{value}</strong>
      <small>{caption}</small>
    </div>
  );
}
function NodeDetails({
  node,
  onClose,
}: {
  node: MapNode;
  onClose: () => void;
}) {
  return (
    <>
      <button
        className="close-node icon-button"
        aria-label="Закрыть сведения об узле"
        onClick={onClose}
      >
        <X size={14} />
      </button>
      <div className="step-op">
        {keyLabel(node.key)} → {valueLabel(node.value)}
      </div>
      <dl>
        {Object.entries({
          type: node.key.type,
          hashCode: node.rawHashCode,
          hash: node.hash,
          next: node.next,
          parent: node.parent,
          left: node.left,
          right: node.right,
          color: node.red === null ? "—" : node.red ? "RED" : "BLACK",
          linked: node.linked,
        }).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v === null ? "null" : String(v)}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
function validInt(value: string) {
  return (
    /^-?\d+$/.test(value) &&
    Number(value) >= -2147483648 &&
    Number(value) <= 2147483647
  );
}
function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Не удалось выполнить запрос";
}
function resultText(trace: Trace) {
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
const algorithm = [
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

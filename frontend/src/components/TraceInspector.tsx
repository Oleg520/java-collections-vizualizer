import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronRight, Code2, Terminal, X } from "lucide-react";
import {
  keyLabel,
  operationLabel,
  valueLabel,
  type MapNode,
  type Step,
  type Trace,
} from "../types";
export function TraceInspector({
  collection,
  trace,
  step,
  cursor,
  historyIndex,
  playing,
  selectedNode,
  onCloseNode,
  navigate,
}: {
  collection?: string;
  trace?: Trace;
  step?: Step;
  cursor: number;
  historyIndex: number;
  playing: boolean;
  selectedNode?: MapNode;
  onCloseNode: () => void;
  navigate: (index: number) => void;
}) {
  const [tab, setTab] = useState<"events" | "algorithm">("events");
  const eventRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const row = eventRef.current,
      list = row?.parentElement;
    if (!row || !list) return;
    const r = row.getBoundingClientRect(),
      l = list.getBoundingClientRect();
    if (r.top < l.top) list.scrollTop -= l.top - r.top;
    else if (r.bottom > l.bottom) list.scrollTop += r.bottom - l.bottom;
  }, [cursor, historyIndex, tab]);

  return (
    <aside className="inspector panel" aria-label="Алгоритм и события">
      <div className="inspector-tabs">
        <button
          className={tab === "events" ? "active" : ""}
          onClick={() => setTab("events")}
        >
          <Terminal size={14} /> Events <span>{trace?.steps.length ?? 0}</span>
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
        <span className="live-label">{playing ? "PLAYING" : "PAUSED"}</span>
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
            Схема этапов, не исполняемый код. Активный этап приходит из Java
            trace.
          </p>
          {(collection === "ARRAY_LIST" ? arrayAlgorithm : algorithm).map(
            ([stage, code, note]) => (
              <div
                key={stage}
                className={step?.stage === stage ? "active" : ""}
              >
                <code>{code}</code>
                <small>{note}</small>
              </div>
            ),
          )}
          <a
            href={`https://github.com/openjdk/jdk21u/blob/${collection === "ARRAY_LIST" ? "jdk-21.0.5%2B11" : "3f3a1f534b7f2f5be6d7ded9d9832fa9394e763c"}/src/java.base/share/classes/java/util/${collection === "ARRAY_LIST" ? "ArrayList" : "HashMap"}.java`}
            target="_blank"
            rel="noreferrer"
          >
            Исходник OpenJDK <ArrowUpRight size={12} />
          </a>
        </div>
      )}
      <div className="technical-details">
        <span className="eyebrow">
          {selectedNode ? `NODE #${selectedNode.id}` : "ТЕХНИЧЕСКИЕ ДЕТАЛИ"}
        </span>
        {selectedNode ? (
          <NodeDetails node={selectedNode} onClose={onCloseNode} />
        ) : step ? (
          <>
            <div className="step-op">{operationLabel(step.operation)}</div>
            <dl>
              {Object.entries(step.details).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>
                    {v === null
                      ? "null"
                      : typeof v === "object"
                        ? JSON.stringify(v)
                        : String(v)}
                  </dd>
                </div>
              ))}
            </dl>
            {Object.keys(step.details).length === 0 && (
              <p>Этап: {step.stage}</p>
            )}
          </>
        ) : (
          <p>Формулы, сравнения и ссылки узлов появятся вместе с trace.</p>
        )}
      </div>
    </aside>
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
            <dd>
              {v === null
                ? "null"
                : typeof v === "object"
                  ? JSON.stringify(v)
                  : String(v)}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
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

const arrayAlgorithm = [
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

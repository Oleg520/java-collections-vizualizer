import type { ReactNode } from "react";
import { operationLabel } from "../presentation/operationLabel";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronRight, Code2, Terminal } from "lucide-react";
import { type Step, type Trace } from "../api/types/index";
export function TraceInspector({
  history,
  algorithm,
  sourceUrl,
  trace,
  step,
  cursor,
  historyIndex,
  playing,
  selectedDetails,
  navigate,
}: {
  history: ReactNode;
  algorithm: string[][];
  sourceUrl: string;
  trace?: Trace;
  step?: Step;
  cursor: number;
  historyIndex: number;
  playing: boolean;
  selectedDetails?: { title: string; content: ReactNode };
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
      <div className="inspector-history">{history}</div>
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
          {algorithm.map(([stage, code, note]) => (
            <div key={stage} className={step?.stage === stage ? "active" : ""}>
              <code>{code}</code>
              <small>{note}</small>
            </div>
          ))}
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            Исходник OpenJDK <ArrowUpRight size={12} />
          </a>
        </div>
      )}
      <div className="technical-details">
        <span className="eyebrow">
          {selectedDetails ? selectedDetails.title : "ТЕХНИЧЕСКИЕ ДЕТАЛИ"}
        </span>
        {selectedDetails ? (
          selectedDetails.content
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

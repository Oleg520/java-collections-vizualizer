import { fieldLabel } from "../i18n/fields";
import { eventExplanation } from "../i18n/events";
import { useI18n } from "../i18n/LocaleProvider";
import type { CSSProperties, ReactNode } from "react";
import { operationLabel } from "../presentation/operationLabel";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronRight, Code2, Terminal } from "lucide-react";
import { type Step, type Trace } from "../api/types/index";
import { DetailValue } from "./DetailValue";
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
  const { locale, t } = useI18n();
  const [tab, setTab] = useState<"events" | "algorithm">("events");
  const eventRef = useRef<HTMLButtonElement>(null);
  const [eventsShare, setEventsShare] = useState(0.55);
  const drag = useRef<{
    pointerId: number;
    y: number;
    share: number;
    height: number;
  }>(null);
  const resizeEvents = (share: number) =>
    setEventsShare(Math.min(0.85, Math.max(0.15, share)));
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
    <aside
      className="inspector panel"
      aria-label={t("TraceInspector.algorithm_and_events")}
    >
      <div className="inspector-tabs">
        <button
          className={tab === "events" ? "active" : ""}
          onClick={() => setTab("events")}
        >
          <Terminal size={14} /> {t("events")}{" "}
          <span>{trace?.steps.length ?? 0}</span>
        </button>
        <button
          className={tab === "algorithm" ? "active" : ""}
          onClick={() => setTab("algorithm")}
        >
          <Code2 size={14} /> {t("algorithm")}
        </button>
      </div>
      <div className="inspector-history">{history}</div>
      <div className="inspector-title">
        <span className="eyebrow">
          {tab === "events"
            ? t("executionTrace")
            : t("TraceInspector.semantic_stages")}
        </span>
        <span className="live-label">
          {playing ? t("playing") : t("paused")}
        </span>
      </div>
      <div
        className="inspector-panes"
        style={
          {
            "--events-share": `${eventsShare}fr`,
            "--details-share": `${1 - eventsShare}fr`,
          } as CSSProperties
        }
      >
        {tab === "events" ? (
          <div
            id="inspector-events"
            className="event-list"
            role="region"
            aria-label={t("TraceInspector.execution_events")}
            tabIndex={0}
          >
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
                    <small>{eventExplanation(locale, s)}</small>
                  </span>
                  {i === cursor && <ChevronRight size={13} />}
                </button>
              ))
            ) : (
              <div className="inspector-empty">
                <Terminal size={25} />
                <p>{t("TraceInspector.the_trace_is_empty")}</p>
                <small>
                  {t(
                    "TraceInspector.events_from_actual_operation_execution_will",
                  )}
                </small>
              </div>
            )}
          </div>
        ) : (
          <div
            id="inspector-events"
            className="algorithm-list"
            role="region"
            aria-label={t("TraceInspector.algorithm_stages")}
            tabIndex={0}
          >
            <p>{t("TraceInspector.a_stage_outline_not_executable_code")}</p>
            {algorithm.map(([stage, code, note]) => (
              <div
                key={stage}
                className={step?.stage === stage ? "active" : ""}
              >
                <code>{code}</code>
                <small>{note}</small>
              </div>
            ))}
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              {t("TraceInspector.openjdk_source")} <ArrowUpRight size={12} />
            </a>
          </div>
        )}
        <div
          className="inspector-splitter"
          role="separator"
          tabIndex={0}
          aria-label={t("TraceInspector.size_of_the_events_and_technical")}
          aria-orientation="horizontal"
          aria-controls="inspector-events inspector-details"
          aria-valuemin={15}
          aria-valuemax={85}
          aria-valuenow={Math.round(eventsShare * 100)}
          aria-valuetext={t("TraceInspector.upper_pane_technical_details", {
            "0": Math.round(eventsShare * 100),
            "1": Math.round((1 - eventsShare) * 100),
          })}
          title={t("TraceInspector.drag_to_resize_keyboard_home_end")}
          onKeyDown={(event) => {
            const increment = event.shiftKey ? 0.1 : 0.05;
            const next = {
              ArrowUp: eventsShare - increment,
              ArrowDown: eventsShare + increment,
              Home: 0.15,
              End: 0.85,
            }[event.key];
            if (next === undefined) return;
            event.preventDefault();
            resizeEvents(next);
          }}
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return;
            const handle = event.currentTarget;
            drag.current = {
              pointerId: event.pointerId,
              y: event.clientY,
              share: eventsShare,
              height: handle.parentElement!.clientHeight - handle.offsetHeight,
            };
            handle.setPointerCapture(event.pointerId);
            handle.focus({ preventScroll: true });
            event.preventDefault();
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (
              !start ||
              event.pointerId !== start.pointerId ||
              start.height <= 0
            )
              return;
            resizeEvents(
              start.share + (event.clientY - start.y) / start.height,
            );
          }}
          onPointerUp={(event) => {
            if (drag.current?.pointerId !== event.pointerId) return;
            drag.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <span aria-hidden="true" />
        </div>
        <div
          id="inspector-details"
          className="technical-details"
          role="region"
          aria-label={t("TraceInspector.technical_details")}
          tabIndex={0}
        >
          <span className="eyebrow">
            {selectedDetails
              ? selectedDetails.title
              : t("TraceInspector.technical_details_heading")}
          </span>
          {selectedDetails ? (
            selectedDetails.content
          ) : step ? (
            <>
              <div className="step-op">
                {operationLabel(step.operation, locale, trace?.collection)}
              </div>
              <dl>
                {Object.entries(step.details).map(([k, v]) => (
                  <div
                    key={k}
                    className={
                      v !== null && typeof v === "object"
                        ? "structured-detail"
                        : undefined
                    }
                  >
                    <dt>{fieldLabel(t, k)}</dt>
                    <dd>
                      <DetailValue
                        value={v}
                        model={
                          k === "result" || k === "element" || k === "key"
                            ? k
                            : undefined
                        }
                        label={(key) => fieldLabel(t, key)}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
              {Object.keys(step.details).length === 0 && (
                <p>
                  {t("TraceInspector.stage")} {step.stage}
                </p>
              )}
            </>
          ) : (
            <p>
              {t("TraceInspector.formulas_comparisons_and_node_links_will")}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

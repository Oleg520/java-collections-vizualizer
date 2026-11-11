import { useState } from "react";
import { operationLabel } from "../presentation/operationLabel";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
} from "lucide-react";
import { type Step } from "../api/types/index";
import type { useTracePlayback } from "./useTracePlayback";
export function PlaybackPanel({
  playback,
  step,
  historical = false,
  stale = false,
}: {
  playback: ReturnType<typeof useTracePlayback>;
  step?: Step;
  historical?: boolean;
  stale?: boolean;
}) {
  const { cursor, playing, speed, setSpeed, trace, navigate, togglePlay } =
    playback;
  const [collapsed, setCollapsed] = useState(false);
  const snapshotStatus = stale
    ? "Синхронизация не подтверждена"
    : step?.snapshot.phase === "WORKING"
      ? "Промежуточный снимок"
      : historical
        ? "Исторический снимок"
        : undefined;
  return (
    <section
      id="playback"
      tabIndex={-1}
      className={`playback panel${collapsed ? " is-collapsed" : ""}`}
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
            onClick={() => navigate(cursor - 1, "step")}
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
            onClick={() => navigate(cursor + 1, "step")}
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
          <span className="step-counter-label">ШАГ</span>
          <b data-testid="step-number">{trace ? cursor + 1 : 0}</b>
          <span>/ {trace?.steps.length ?? 0}</span>
        </div>
        <div
          className="step-explanation"
          role="region"
          aria-label="Пояснение текущего шага"
          tabIndex={0}
          hidden={collapsed}
          title={step?.message}
        >
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
              {snapshotStatus && (
                <>
                  <span role="status">{snapshotStatus}</span> ·{" "}
                </>
              )}
              {step?.details.formula
                ? String(step.details.formula)
                : step
                  ? `${step.event} · ${operationLabel(step.operation)}`
                  : "Воспроизведение управляет временем, а не состоянием Java-коллекции."}
            </code>
          </div>
        </div>
        <button
          className="icon-button collapse-playback"
          aria-label={collapsed ? "Развернуть плеер" : "Свернуть плеер"}
          title={collapsed ? "Развернуть плеер" : "Свернуть плеер"}
          aria-expanded={!collapsed}
          aria-controls="playback-details"
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
      <div id="playback-details" hidden={collapsed}>
        <div className="playback-timeline">
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
      </div>
    </section>
  );
}

export function OperationHistory({
  playback: { history, historyIndex },
  onSelectHistory,
}: {
  playback: ReturnType<typeof useTracePlayback>;
  onSelectHistory: (index: number) => void;
}) {
  return (
    <div className="history-bar">
      <Layers size={14} />
      <label htmlFor="history">История операций</label>
      <select
        id="history"
        value={historyIndex}
        onChange={(e) => {
          onSelectHistory(Number(e.target.value));
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
  );
}

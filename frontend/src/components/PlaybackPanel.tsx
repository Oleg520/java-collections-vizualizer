import {
  ArrowRight,
  Check,
  Layers,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
} from "lucide-react";
import { operationLabel, type Step } from "../types";
import type { useTracePlayback } from "../hooks/useTracePlayback";
export function PlaybackPanel({
  playback,
  step,
  onSelectHistory,
}: {
  playback: ReturnType<typeof useTracePlayback>;
  step?: Step;
  onSelectHistory: (index: number) => void;
}) {
  const {
    history,
    historyIndex,
    cursor,
    playing,
    speed,
    setSpeed,
    trace,
    navigate,
    togglePlay,
  } = playback;
  return (
    <>
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
            ШАГ <b data-testid="step-number">{trace ? cursor + 1 : 0}</b>
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
    </>
  );
}

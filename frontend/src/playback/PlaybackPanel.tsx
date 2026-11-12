import { eventExplanation } from "../i18n/events";
import { useI18n } from "../i18n/LocaleProvider";
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
  const { locale, t } = useI18n();
  const { cursor, playing, speed, setSpeed, trace, navigate, togglePlay } =
    playback;
  const [collapsed, setCollapsed] = useState(false);
  const snapshotStatus = stale
    ? t("PlaybackPanel.synchronization_unconfirmed")
    : step?.snapshot.phase === "WORKING"
      ? t("PlaybackPanel.working_snapshot")
      : historical
        ? t("PlaybackPanel.historical_snapshot")
        : undefined;
  return (
    <section
      id="playback"
      tabIndex={-1}
      className={`playback panel${collapsed ? " is-collapsed" : ""}`}
      aria-label={t("PlaybackPanel.playback_controls")}
    >
      <div className="playback-top">
        <div className="transport">
          <button
            className="icon-button"
            aria-label={t("PlaybackPanel.go_to_beginning")}
            disabled={!trace}
            onClick={() => navigate(0)}
          >
            <SkipBack size={17} />
          </button>
          <button
            className="icon-button"
            aria-label={t("PlaybackPanel.step_back")}
            disabled={!trace || cursor === 0}
            onClick={() => navigate(cursor - 1, "step")}
          >
            <StepBack size={19} />
          </button>
          <button
            className="play-button"
            aria-label={playing ? t("pause") : t("play")}
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
            aria-label={t("PlaybackPanel.step_forward")}
            disabled={!trace || cursor === trace.steps.length - 1}
            onClick={() => navigate(cursor + 1, "step")}
          >
            <StepForward size={19} />
          </button>
          <button
            className="icon-button"
            aria-label={t("PlaybackPanel.go_to_end")}
            disabled={!trace}
            onClick={() => navigate((trace?.steps.length ?? 1) - 1)}
          >
            <SkipForward size={17} />
          </button>
        </div>
        <div className="step-counter">
          <span className="step-counter-label">{t("PlaybackPanel.step")}</span>
          <b data-testid="step-number">{trace ? cursor + 1 : 0}</b>
          <span>/ {trace?.steps.length ?? 0}</span>
        </div>
        <div
          className="step-explanation"
          role="region"
          aria-label={t("PlaybackPanel.current_step_explanation")}
          tabIndex={0}
          hidden={collapsed}
          title={step ? eventExplanation(locale, step) : undefined}
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
              {(step ? eventExplanation(locale, step) : undefined) ??
                t("PlaybackPanel.operations_become_understandable_steps")}
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
                  ? `${step.event} · ${operationLabel(step.operation, locale, trace?.collection)}`
                  : t(
                      "PlaybackPanel.playback_controls_time_not_java_collection",
                    )}
            </code>
          </div>
        </div>
        <button
          className="icon-button collapse-playback"
          aria-label={
            collapsed
              ? t("PlaybackPanel.expand_player")
              : t("PlaybackPanel.collapse_player")
          }
          title={
            collapsed
              ? t("PlaybackPanel.expand_player")
              : t("PlaybackPanel.collapse_player")
          }
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
            aria-label={t("PlaybackPanel.playback_position")}
            className="timeline"
            type="range"
            min="0"
            max={Math.max(1, (trace?.steps.length ?? 1) - 1)}
            value={cursor}
            onChange={(e) => navigate(Number(e.target.value))}
            disabled={!trace}
          />
          <label className="speed-control">
            <span>{t("PlaybackPanel.speed")}</span>
            <select
              aria-label={t("PlaybackPanel.playback_speed")}
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
  const { t, locale } = useI18n();
  return (
    <div className="history-bar">
      <Layers size={14} />
      <label htmlFor="history">{t("PlaybackPanel.operation_history")}</label>
      <select
        id="history"
        value={historyIndex}
        onChange={(e) => {
          onSelectHistory(Number(e.target.value));
        }}
      >
        <option value="-1">{t("PlaybackPanel.current_server_state")}</option>
        {history.map((t, i) => (
          <option key={i} value={i}>
            {i + 1}. {operationLabel(t.operation, locale, t.collection)}
          </option>
        ))}
      </select>
      <span>{t("PlaybackPanel.last_12")}</span>
    </div>
  );
}

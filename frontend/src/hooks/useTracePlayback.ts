import { useEffect, useState } from "react";
import type { Trace } from "../types";

/** Owns immutable operation history and local playback; navigation never calls the API. */
export function useTracePlayback() {
  const [history, setHistory] = useState<Trace[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const trace = history[historyIndex];
  const step = trace?.steps[cursor];

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

  const pause = () => setPlaying(false);
  const showCommitted = () => {
    setHistoryIndex(-1);
    setCursor(0);
  };
  const reset = () => {
    setHistory([]);
    showCommitted();
  };
  const accept = (next: Trace) => {
    setHistory((prev) => [...prev.slice(-11), next]);
    setHistoryIndex(Math.min(history.length, 11));
    setCursor(0);
    setPlaying(true);
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
  const selectHistory = (index: number) => {
    setHistoryIndex(index);
    setCursor(0);
    setPlaying(false);
  };

  return {
    history,
    historyIndex,
    cursor,
    playing,
    speed,
    setSpeed,
    trace,
    step,
    pause,
    reset,
    accept,
    showCommitted,
    navigate,
    togglePlay,
    selectHistory,
  };
}

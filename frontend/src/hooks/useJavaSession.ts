import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api";
import type {
  Operation,
  Scenario,
  Session,
  SessionTrace,
  Trace,
} from "../types";

interface PlaybackActions {
  pause: () => void;
  reset: () => void;
  accept: (trace: Trace) => void;
  showCommitted: () => void;
}

/** Owns committed Java state and serializes requests, including explicit session recovery. */
export function useJavaSession(playback: PlaybackActions) {
  const [session, setSession] = useState<Session | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const startSession = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    playback.pause();
    try {
      const [newSession, demos] = await Promise.all([
        api.create(),
        api.scenarios(),
      ]);
      setSession(newSession);
      setScenarios(demos);
      playback.reset();
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

  const execute = async (request: () => Promise<SessionTrace>) => {
    if (busyRef.current || !session) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    playback.pause();
    try {
      const response = await request();
      setSession({
        ...session,
        revision: response.revision,
        state: response.trace.committed,
      });
      playback.accept(response.trace);
    } catch (e) {
      setError(errorMessage(e));
      // A lost response may have committed: recover state but never retry the mutation.
      if (e instanceof ApiError && (e.status === 409 || e.status === 0)) {
        try {
          setSession(await api.get(session.id));
          playback.showCommitted();
        } catch {
          /* Keep the original actionable error; explicit recovery remains available. */
        }
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const command = (operation: Operation) => {
    if (session) void execute(() => api.command(session, operation));
  };
  const demo = (name: string) => {
    if (session) void execute(() => api.scenario(session, name));
  };

  return {
    session,
    scenarios,
    busy,
    slow,
    error,
    setError,
    startSession,
    command,
    demo,
  };
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Не удалось выполнить запрос";
}

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api";
import type {
  CollectionType,
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
  const epoch = useRef(0);
  const config = useRef<{ collection: CollectionType; capacity?: number }>({
    collection: "HASH_MAP",
  });
  const [collection, setCollection] = useState<CollectionType>("HASH_MAP");

  const startSession = async (
    next = config.current.collection,
    capacity: number | null | undefined = next === config.current.collection
      ? config.current.capacity
      : undefined,
  ) => {
    const generation = ++epoch.current;
    config.current = { collection: next, capacity: capacity ?? undefined };
    setCollection(next);
    setSession(null);
    setScenarios([]);
    playback.reset();
    busyRef.current = true;
    setBusy(true);
    setError(null);
    playback.pause();
    try {
      const [newSession, demos] = await Promise.all([
        api.create(next, capacity ?? undefined),
        api.scenarios(next),
      ]);
      if (generation !== epoch.current) return;
      setSession(newSession);
      setScenarios(demos);
      playback.reset();
    } catch (e) {
      if (generation !== epoch.current) return;
      setError(errorMessage(e));
    } finally {
      if (generation === epoch.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  useEffect(() => {
    void startSession();
    return () => {
      epoch.current++;
    };
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
    const generation = epoch.current;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    playback.pause();
    try {
      const response = await request();
      if (generation !== epoch.current) return;
      setSession({
        ...session,
        revision: response.revision,
        state: response.trace.committed,
      });
      playback.accept(response.trace);
    } catch (e) {
      if (generation !== epoch.current) return;
      setError(errorMessage(e));
      // A lost response may have committed: recover state but never retry the mutation.
      if (e instanceof ApiError && (e.status === 409 || e.status === 0)) {
        try {
          const recovered = await api.get(session.id);
          if (generation !== epoch.current) return;
          setSession(recovered);
          playback.showCommitted();
        } catch {
          /* Keep the original actionable error; explicit recovery remains available. */
        }
      }
    } finally {
      if (generation === epoch.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };
  const command = (operation: Operation) => {
    if (session) void execute(() => api.command(session, operation));
  };
  const demo = (name: string) => {
    if (session) void execute(() => api.scenario(session, name));
  };

  return {
    collection,
    switchCollection: (next: CollectionType) => void startSession(next, null),
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

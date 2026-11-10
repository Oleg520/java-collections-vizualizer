import type { LocalSplits } from "../dev/splitScenarios";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/api";
import { SessionConnection } from "./sessionConnection";
import type {
  CollectionType,
  Operation,
  Scenario,
  Session,
  SessionTrace,
  Trace,
} from "../api/types/index";

interface PlaybackActions {
  pause: () => void;
  reset: () => void;
  accept: (trace: Trace) => void;
  showCommitted: () => void;
}

/** Owns committed Java state and serializes requests, including explicit session recovery. */
export function useJavaSession(
  playback: PlaybackActions,
  localSplits?: LocalSplits,
) {
  const [session, setSession] = useState<Session | null>(null);
  const [lastKnownSession, setLastKnownSession] = useState<Session | null>(
    null,
  );
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const epoch = useRef(0);
  const connection = useRef(new SessionConnection());
  const config = useRef<{ collection: CollectionType; capacity?: number }>({
    collection: "HASH_MAP",
  });
  const [collection, setCollection] = useState<CollectionType>("HASH_MAP");

  const reportError = (e: unknown) => {
    if (e instanceof ApiError)
      connection.current.retryAt = Math.max(
        connection.current.retryAt,
        e.retryAt,
      );
    const message =
      session && !connection.current.session
        ? "Сессия истекла или Java-сервис перезапущен. Создайте новую сессию. Прежнее состояние сервера недоступно."
        : errorMessage(e);
    setError(
      message +
        (connection.current.needsRefresh
          ? " Актуальное состояние пока не получено. Обновите состояние перед следующей командой."
          : ""),
    );
  };

  const listScenarios = async (type: CollectionType) => {
    const demos = await api.scenarios(type);
    return type === "HASH_MAP" && localSplits
      ? [...demos, ...localSplits.scenarios]
      : demos;
  };

  const startSession = async (
    next = config.current.collection,
    capacity: number | null | undefined = next === config.current.collection
      ? config.current.capacity
      : undefined,
  ) => {
    if (Date.now() < connection.current.retryAt) return;
    // Capture the user intent before the catalog request can delay queue entry.
    const creationFailure = connection.current.creationFailure;
    const changedCollection = next !== config.current.collection;
    const generation = ++epoch.current;
    config.current = { collection: next, capacity: capacity ?? undefined };
    setCollection(next);
    if (changedCollection) {
      setSession(null);
      setScenarios([]);
      playback.reset();
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    playback.pause();
    try {
      const demos = await listScenarios(next);
      if (generation === epoch.current) setScenarios(demos);
      const newSession = await connection.current.change(
        next,
        capacity ?? undefined,
        () => generation === epoch.current,
        creationFailure,
      );
      if (generation !== epoch.current) return;
      if (!newSession) return;
      setSession(newSession);
      setScenarios(demos);
      playback.reset();
    } catch (e) {
      if (generation !== epoch.current) return;
      reportError(e);
      setSession(
        connection.current.session?.collection === next
          ? connection.current.session
          : null,
      );
      playback.showCommitted();
    } finally {
      if (generation === epoch.current) {
        setRetryAt(connection.current.retryAt);
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
    if (session) setLastKnownSession(session);
  }, [session]);
  useEffect(() => {
    const currentTime = Date.now();
    setNow(currentTime);
    if (retryAt <= currentTime) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [retryAt, retryAt > now]);
  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return;
    }
    const timeout = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(timeout);
  }, [busy]);

  const execute = async (
    work: (
      connection: SessionConnection,
      active: () => boolean,
    ) => Promise<SessionTrace>,
  ) => {
    if (
      busyRef.current ||
      !session ||
      connection.current.needsRefresh ||
      Date.now() < connection.current.retryAt
    )
      return;
    const generation = epoch.current;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    playback.pause();
    try {
      const response = await work(
        connection.current,
        () => generation === epoch.current,
      );
      if (generation !== epoch.current) return;
      setSession(connection.current.session);
      playback.accept(response.trace);
    } catch (e) {
      if (generation !== epoch.current) return;
      reportError(e);
      const current = connection.current.session;
      setSession(current);
      if (current && current.collection !== config.current.collection) {
        config.current = { collection: current.collection as CollectionType };
        setCollection(current.collection as CollectionType);
        playback.reset();
      } else playback.showCommitted();
    } finally {
      if (generation === epoch.current) {
        setRetryAt(connection.current.retryAt);
        busyRef.current = false;
        setBusy(false);
      }
    }
  };
  const command = (operation: Operation) => {
    if (session)
      void execute((conn) =>
        conn.execute((current) => api.command(current, operation)),
      );
  };
  const demo = (name: string) => {
    if (!session) return;
    if (localSplits?.scenarios.some((s) => s.id === name))
      void execute((conn, active) => localSplits.run(name, conn, active));
    else
      void execute((conn) =>
        conn.execute((current) => api.scenario(current, name)),
      );
  };

  const recoverSession = async () => {
    if (busyRef.current || Date.now() < connection.current.retryAt) return;
    // A failed initial connection or a requested collection switch is explicit.
    if (
      !connection.current.session ||
      connection.current.session.collection !== collection
    ) {
      await startSession();
      return;
    }
    const generation = epoch.current;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    playback.pause();
    try {
      const current = await connection.current.refresh();
      if (generation !== epoch.current) return;
      setSession(current);
      if (current && current.collection !== collection) {
        config.current = { collection: current.collection as CollectionType };
        setCollection(current.collection as CollectionType);
        playback.reset();
      } else playback.showCommitted();
      const demos = await listScenarios(
        (current?.collection ?? collection) as CollectionType,
      );
      if (generation === epoch.current) setScenarios(demos);
    } catch (e) {
      if (generation !== epoch.current) return;
      setSession(
        connection.current.session?.collection === config.current.collection
          ? connection.current.session
          : null,
      );
      playback.showCommitted();
      reportError(e);
    } finally {
      if (generation === epoch.current) {
        setRetryAt(connection.current.retryAt);
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  return {
    collection,
    lastKnownSession,
    recoverSession,
    recoveryLabel: !connection.current.session
      ? "Новая сессия"
      : connection.current.session.collection !== collection
        ? "Повторить подключение"
        : "Обновить состояние",
    retrySeconds: Math.max(0, Math.ceil((retryAt - now) / 1000)),
    uncertain: connection.current.needsRefresh,
    blocked: connection.current.needsRefresh || now < retryAt,
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

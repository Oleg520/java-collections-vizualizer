import type { LocalSplits } from "../dev/splitScenarios";
import type { NodeSelection } from "../features/hashmap/identity";
import {
  collectionViews,
  collectionOptions,
  statePresentation,
} from "./collectionViews";
import { useState } from "react";
import type { CollectionType } from "../api/types";
import {
  ArrowUpRight,
  ChevronRight,
  Github,
  Info,
  LoaderCircle,
  Network,
  X,
} from "lucide-react";
import { OperationHistory, PlaybackPanel } from "../playback/PlaybackPanel";
import { ScenarioSidebar } from "../components/ScenarioSidebar";
import { StateMetrics } from "../components/StateMetrics";
import { TraceInspector } from "../components/TraceInspector";
import { CollectionHelp } from "../components/CollectionHelp";
import { useJavaSession } from "../session/useJavaSession";
import { useTracePlayback } from "../playback/useTracePlayback";

export default function App({
  localSplits,
}: { localSplits?: LocalSplits } = {}) {
  const playback = useTracePlayback();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<NodeSelection>();
  const {
    collection,
    lastKnownSession,
    recoverSession,
    recoveryLabel,
    retrySeconds,
    blocked,
    uncertain,
    switchCollection,
    session,
    scenarios,
    busy,
    slow,
    error,
    setError,
    startSession,
    command,
    demo,
  } = useJavaSession(
    {
      pause: playback.pause,
      reset: () => {
        playback.reset();
        setSelectedNodeId(undefined);
      },
      accept: (trace) => {
        playback.accept(trace);
        setSelectedNodeId(undefined);
      },
      showCommitted: playback.showCommitted,
    },
    localSplits,
  );
  const { trace, step, cursor, historyIndex, playing, navigate } = playback;
  const historical =
    !!trace &&
    (historyIndex < playback.history.length - 1 ||
      cursor < trace.steps.length - 1);
  const snapshot =
    step?.snapshot ??
    session?.state ??
    (lastKnownSession?.collection === collection
      ? lastKnownSession.state
      : undefined);
  const view = collectionViews[collection];
  const details = view.selectedDetails(
    snapshot,
    selectedNodeId,
    () => setSelectedNodeId(undefined),
    setSelectedNodeId,
  );
  return (
    <div className="app-shell">
      <a className="skip-playback" href="#playback">
        К управлению воспроизведением
      </a>
      <header className="app-header">
        <div className="header-left">
          <a
            className="brand"
            href="/"
            aria-label="Java Collections Visualizer"
          >
            <span className="brand-mark">
              <Network size={23} />
            </span>
            <span className="brand-name">Visualizer</span>
          </a>
          <span className="version">{__APP_VERSION__}</span>
          <nav className="breadcrumbs" aria-label="Java Collections Framework">
            <span
              className="breadcrumb-ancestor"
              title="Java Collections Framework"
            >
              Collections
            </span>
            <ChevronRight
              className="breadcrumb-ancestor"
              size={12}
              aria-hidden="true"
            />
            <span className="breadcrumb-ancestor">{view.family}</span>
            <ChevronRight
              className="breadcrumb-ancestor"
              size={12}
              aria-hidden="true"
            />
            <select
              className="collection-select"
              aria-label="Коллекция"
              aria-describedby="collection-switch-hint"
              value={collection}
              onChange={(event) =>
                switchCollection(event.target.value as CollectionType)
              }
            >
              {collectionOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </nav>
        </div>
        <div className="header-right">
          <span className={`connection ${session ? "online" : ""}`}>
            <i />
            {busy
              ? "Java выполняет…"
              : error
                ? "Ошибка запроса"
                : session
                  ? "Java engine connected"
                  : "Подключение к Java"}
          </span>
          <a
            className="repo-link"
            href="https://github.com/Oleg520/java-collections-vizualizer"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Исходный код проекта на GitHub"
            title="Исходный код проекта на GitHub"
          >
            <Github size={15} />
            <span>GitHub</span>
            <ArrowUpRight size={14} />
          </a>
          <CollectionHelp description={view.description} />
        </div>
      </header>
      <div
        className={`workspace${sidebarCollapsed ? " sidebar-collapsed" : ""}`}
      >
        <ScenarioSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((value) => !value)}
          scenarios={scenarios}
          trace={trace}
          busy={busy || blocked}
          session={session}
          onDemo={demo}
        />
        <main>
          <h1 className="sr-only">Лаборатория {view.name}</h1>
          <div className="control-area">
            {error && (
              <div className="error-banner" role="alert">
                <Info size={18} />
                <span>
                  {error}
                  {retrySeconds > 0 &&
                    ` Повторный запрос через ${retrySeconds} сек.`}
                </span>
                <button
                  onClick={() => void recoverSession()}
                  disabled={busy || retrySeconds > 0}
                >
                  {recoveryLabel}
                </button>
                <button
                  className="icon-button"
                  aria-label="Закрыть ошибку"
                  disabled={blocked || !session}
                  onClick={() => setError(null)}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {slow && (
              <div className="loading-banner" role="status">
                <LoaderCircle size={16} className="spin" /> Ожидаем Java-сервис.
                После ошибки можно безопасно обновить состояние.
              </div>
            )}
            <view.Commands
              metrics={
                <StateMetrics
                  {...statePresentation(
                    snapshot,
                    trace,
                    busy ? undefined : cursor,
                  )}
                />
              }
              busy={busy}
              blocked={blocked}
              session={session}
              onCommand={command}
              onError={setError}
              onCreate={(capacity) =>
                void startSession(collection, capacity ?? null)
              }
            />
          </div>
          <div className="lab-grid">
            <div className="canvas-column">
              {snapshot ? (
                <view.Diagram
                  playing={playing}
                  trace={trace}
                  cursor={cursor}
                  speed={playback.speed}
                  navigation={playback.navigation}
                  snapshot={snapshot}
                  step={step}
                  selectedId={selectedNodeId}
                  onSelect={setSelectedNodeId}
                />
              ) : (
                <div className="panel connecting">
                  <LoaderCircle className={busy ? "spin" : ""} />
                  <h2>
                    {busy
                      ? "Подключаем Java-движок"
                      : "Нет соединения с Java-движком"}
                  </h2>
                  <p>Состояние коллекции появится после создания сессии.</p>
                </div>
              )}
              <PlaybackPanel
                playback={playback}
                step={step}
                historical={historical}
                stale={uncertain || !session}
              />
              {localSplits &&
                trace?.operation.type === "SCENARIO" &&
                localSplits.scenarios.some(
                  (s) => s.id === trace.operation.value,
                ) && (
                  <button
                    className="subtle-button"
                    disabled={busy}
                    onClick={() => navigate(localSplits.problemFrame)}
                  >
                    {localSplits.jumpLabel}
                  </button>
                )}
            </div>
            <TraceInspector
              history={
                <OperationHistory
                  playback={playback}
                  onSelectHistory={(index) => {
                    playback.selectHistory(index);
                    setSelectedNodeId(undefined);
                  }}
                />
              }
              algorithm={view.algorithm}
              sourceUrl={view.sourceUrl}
              trace={trace}
              step={step}
              cursor={cursor}
              historyIndex={historyIndex}
              playing={playing}
              selectedDetails={details}
              navigate={navigate}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

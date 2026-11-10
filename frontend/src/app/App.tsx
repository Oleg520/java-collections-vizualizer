import type { LocalSplits } from "../dev/splitScenarios";
import type { NodeSelection } from "../features/hashmap/identity";
import {
  collectionViews,
  collectionOptions,
  statePresentation,
} from "./collectionViews";
import { useState } from "react";
import {
  ArrowUpRight,
  Braces,
  ChevronRight,
  GitBranch,
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
import { useJavaSession } from "../session/useJavaSession";
import { useTracePlayback } from "../playback/useTracePlayback";

export default function App({
  localSplits,
}: { localSplits?: LocalSplits } = {}) {
  const playback = useTracePlayback();
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
      <div className="page-scroll">
        <a className="skip-playback" href="#playback">
          К управлению воспроизведением
        </a>
        <header className="app-header">
          <a
            className="brand"
            href="/"
            aria-label="Java Collections Visualizer"
          >
            <span className="brand-mark">
              <Network size={23} />
            </span>
            <span>
              Collections<span className="brand-suffix"> / visualizer</span>
            </span>
            <span className="version">{__APP_VERSION__}</span>
          </a>
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
            <a href={view.sourceUrl} target="_blank" rel="noreferrer">
              OpenJDK 21 <ArrowUpRight size={14} />
            </a>
          </div>
        </header>
        <div className="workspace">
          <ScenarioSidebar
            collection={collection}
            collections={collectionOptions}
            onCollection={switchCollection}
            scenarios={scenarios}
            trace={trace}
            busy={busy || blocked}
            session={session}
            onDemo={demo}
          />
          <main>
            <div className="page-heading">
              <div>
                <div className="breadcrumbs">
                  Collections <ChevronRight size={12} /> {view.family}{" "}
                  <ChevronRight size={12} /> <span>{view.name}</span>
                </div>
                <h1>
                  Понять, что внутри<span>.</span>
                </h1>
                <p>{view.description}</p>
              </div>
              <div className="model-badge">
                <GitBranch size={16} />
                <div>
                  Учебная модель<span>по алгоритмам OpenJDK 21</span>
                </div>
              </div>
            </div>
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
              busy={busy}
              blocked={blocked}
              session={session}
              onCommand={command}
              onError={setError}
              onCreate={(capacity) =>
                void startSession(collection, capacity ?? null)
              }
            />
            <StateMetrics
              snapshot={snapshot}
              session={session}
              stale={uncertain || !session}
              {...statePresentation(snapshot, trace)}
            />
            <div className="lab-grid">
              <div className="canvas-column">
                {snapshot ? (
                  <view.Diagram
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
                <OperationHistory
                  playback={playback}
                  onSelectHistory={(index) => {
                    playback.selectHistory(index);
                    setSelectedNodeId(undefined);
                  }}
                />
              </div>
              <TraceInspector
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
            <footer className="page-footer">
              <span>
                <Braces size={13} /> Java — источник истины. React —
                представление.
              </span>
              <span>128 элементов / сессия · шаги доступны без соединения</span>
            </footer>
          </main>
        </div>
      </div>
      <div className="playback-dock">
        <PlaybackPanel playback={playback} step={step} />
      </div>
    </div>
  );
}

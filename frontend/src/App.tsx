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
import { Diagram } from "./Diagram";
import { CommandPanel } from "./components/CommandPanel";
import { PlaybackPanel } from "./components/PlaybackPanel";
import { ScenarioSidebar } from "./components/ScenarioSidebar";
import { StateMetrics } from "./components/StateMetrics";
import { TraceInspector } from "./components/TraceInspector";
import { useJavaSession } from "./hooks/useJavaSession";
import { useTracePlayback } from "./hooks/useTracePlayback";

export default function App() {
  const playback = useTracePlayback();
  const [selectedNodeId, setSelectedNodeId] = useState<number>();
  const {
    session,
    scenarios,
    busy,
    slow,
    error,
    setError,
    startSession,
    command,
    demo,
  } = useJavaSession({
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
  });
  const { trace, step, cursor, historyIndex, playing, navigate } = playback;
  const snapshot = step?.snapshot ?? session?.state;
  const selectedNode = snapshot
    ? [...snapshot.buckets, ...snapshot.pendingBuckets]
        .flatMap((b) => b.nodes)
        .find((n) => n.id === selectedNodeId)
    : undefined;
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="Java Collections Visualizer">
          <span className="brand-mark">
            <Network size={23} />
          </span>
          <span>
            Collections<span className="brand-suffix"> / visualizer</span>
          </span>
          <span className="version">v0.1</span>
        </a>
        <div className="header-right">
          <span className={`connection ${session ? "online" : ""}`}>
            <i />
            {busy
              ? "Java выполняет…"
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
          <a
            href="https://github.com/openjdk/jdk21u/blob/master/src/java.base/share/classes/java/util/HashMap.java"
            target="_blank"
            rel="noreferrer"
          >
            OpenJDK 21 <ArrowUpRight size={14} />
          </a>
        </div>
      </header>
      <div className="workspace">
        <ScenarioSidebar
          scenarios={scenarios}
          trace={trace}
          busy={busy}
          session={session}
          onDemo={demo}
        />
        <main>
          <div className="page-heading">
            <div>
              <div className="breadcrumbs">
                Collections <ChevronRight size={12} /> Map{" "}
                <ChevronRight size={12} /> <span>HashMap</span>
              </div>
              <h1>
                Понять, что внутри<span>.</span>
              </h1>
              <p>Добавляйте ключи. Следите за связями. Исследуйте алгоритм.</p>
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
              <span>{error}</span>
              <button onClick={() => void startSession()} disabled={busy}>
                Новая сессия
              </button>
              <button
                className="icon-button"
                aria-label="Закрыть ошибку"
                onClick={() => setError(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {slow && (
            <div className="loading-banner" role="status">
              <LoaderCircle size={16} className="spin" /> Ожидаем Java-сервис.
              При холодном запуске это может занять до минуты.
            </div>
          )}
          <CommandPanel
            busy={busy}
            session={session}
            onCommand={command}
            onError={setError}
          />
          <StateMetrics snapshot={snapshot} session={session} trace={trace} />
          <div className="lab-grid">
            <div className="canvas-column">
              {snapshot ? (
                <Diagram
                  state={snapshot}
                  step={step}
                  selectedId={selectedNodeId}
                  onSelect={(n) =>
                    setSelectedNodeId(
                      n.id === selectedNodeId ? undefined : n.id,
                    )
                  }
                />
              ) : (
                <div className="panel connecting">
                  <LoaderCircle className="spin" />
                  <h2>Подключаем Java-движок</h2>
                  <p>Состояние коллекции появится после создания сессии.</p>
                </div>
              )}
              <PlaybackPanel
                playback={playback}
                step={step}
                onSelectHistory={(index) => {
                  playback.selectHistory(index);
                  setSelectedNodeId(undefined);
                }}
              />
            </div>
            <TraceInspector
              trace={trace}
              step={step}
              cursor={cursor}
              historyIndex={historyIndex}
              playing={playing}
              selectedNode={selectedNode}
              onCloseNode={() => setSelectedNodeId(undefined)}
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
  );
}

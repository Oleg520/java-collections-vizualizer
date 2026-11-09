import { BookOpen, Braces, ChevronRight, RotateCcw } from "lucide-react";
import type {
  CollectionType,
  Scenario,
  Session,
  Trace,
} from "../api/types/index";
export function ScenarioSidebar({
  collection,
  collections,
  onCollection,
  scenarios,
  trace,
  busy,
  session,
  onDemo: demo,
}: {
  collection: CollectionType;
  collections: { id: CollectionType; name: string; number: string }[];
  onCollection: (collection: CollectionType) => void;
  scenarios: Scenario[];
  trace?: Trace;
  busy: boolean;
  session: Session | null;
  onDemo: (name: string) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <span className="eyebrow">КОЛЛЕКЦИЯ</span>
        <label className="sr-only" htmlFor="collection">
          Коллекция
        </label>
        <div className="collection-selector">
          <Braces size={19} />
          <select
            id="collection"
            value={collection}
            onChange={(e) => onCollection(e.target.value as CollectionType)}
          >
            {collections.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <span>
            {collections.find((item) => item.id === collection)?.number}
          </span>
        </div>
        <p className="sidebar-note">
          Java Collections Framework
          <br />
          Интерактивная лаборатория
        </p>
      </div>
      <div className="sidebar-section scenarios">
        <div className="sidebar-title">
          <span className="eyebrow">ГОТОВЫЕ СЦЕНАРИИ</span>
          <BookOpen size={14} />
        </div>
        <p className="sidebar-description">
          Один запуск — весь путь алгоритма.
        </p>
        {scenarios.map((s, i) => (
          <button
            key={s.id}
            className={`scenario-button ${trace?.operation.value === s.id && trace.operation.type === "SCENARIO" ? "selected" : ""}`}
            onClick={() => demo(s.id)}
            disabled={busy || !session}
            title={s.description}
          >
            <span className="scenario-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>
              <strong>{s.title}</strong>
              <small>{s.description}</small>
            </span>
            <ChevronRight size={14} />
          </button>
        ))}
        <p className="scenario-reset-note">
          <RotateCcw size={12} /> Каждый сценарий начинает с пустой коллекции.
        </p>
      </div>
      <div className="sidebar-bottom">
        <div className="java-badge">
          J<span>21</span>
        </div>
        <p>
          Алгоритм живёт в Java.
          <br />
          <span>Здесь вы видите каждый шаг.</span>
        </p>
      </div>
    </aside>
  );
}

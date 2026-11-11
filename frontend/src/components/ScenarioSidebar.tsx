import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { Scenario, Session, Trace } from "../api/types/index";
export function ScenarioSidebar({
  collapsed,
  onToggle,
  scenarios,
  trace,
  busy,
  session,
  onDemo: demo,
}: {
  collapsed: boolean;
  onToggle: () => void;
  scenarios: Scenario[];
  trace?: Trace;
  busy: boolean;
  session: Session | null;
  onDemo: (name: string) => void;
}) {
  return (
    <aside className="sidebar" aria-label="Готовые сценарии коллекции">
      <div className="sidebar-title">
        <h2>Готовые сценарии</h2>
        <button
          className="sidebar-toggle icon-button"
          aria-label={
            collapsed ? "Развернуть боковую панель" : "Свернуть боковую панель"
          }
          aria-expanded={!collapsed}
          aria-controls="sidebar-content"
          title={
            collapsed ? "Развернуть боковую панель" : "Свернуть боковую панель"
          }
          onClick={onToggle}
        >
          {collapsed ? (
            <PanelLeftOpen size={19} />
          ) : (
            <PanelLeftClose size={19} />
          )}
        </button>
      </div>
      <div className="sidebar-content" id="sidebar-content">
        <div className="sidebar-section scenarios">
          <span id="scenario-reset-hint" className="sr-only">
            Запуск сценария заменяет содержимое коллекции своим начальным
            состоянием.
          </span>
          <div
            className="scenario-list"
            role="region"
            aria-label="Готовые сценарии"
            tabIndex={0}
          >
            {scenarios.map((s, i) => (
              <button
                key={s.id}
                className={`scenario-button ${trace?.operation.value === s.id && trace.operation.type === "SCENARIO" ? "selected" : ""}`}
                onClick={() => demo(s.id)}
                disabled={busy || !session}
                title={`${s.description} Запуск заменяет содержимое коллекции.`}
                aria-describedby="scenario-reset-hint"
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
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className="java-badge">
            J<span>21</span>
          </div>
          <p>
            Java — источник истины.
            <br />
            <span>React — представление.</span>
          </p>
        </div>
      </div>
    </aside>
  );
}

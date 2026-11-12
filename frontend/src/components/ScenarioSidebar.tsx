import { scenarioText } from "../i18n/scenarios";
import { useI18n } from "../i18n/LocaleProvider";
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
  const { t, locale } = useI18n();
  return (
    <aside
      className="sidebar"
      aria-label={t("ScenarioSidebar.collection_scenarios")}
    >
      <div className="sidebar-title">
        <h2>{t("ScenarioSidebar.ready_made_scenarios")}</h2>
        <button
          className="sidebar-toggle icon-button"
          aria-label={
            collapsed
              ? t("ScenarioSidebar.expand_sidebar")
              : t("ScenarioSidebar.collapse_sidebar")
          }
          aria-expanded={!collapsed}
          aria-controls="sidebar-content"
          title={
            collapsed
              ? t("ScenarioSidebar.expand_sidebar")
              : t("ScenarioSidebar.collapse_sidebar")
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
            {t("ScenarioSidebar.running_a_scenario_replaces_the_collection")}
          </span>
          <div
            className="scenario-list"
            role="region"
            aria-label={t("ScenarioSidebar.ready_made_scenarios")}
            tabIndex={0}
          >
            {scenarios.map((s, i) => {
              const text = scenarioText(
                locale,
                session?.collection ?? "HASH_MAP",
                s.id,
              );
              return (
                <button
                  key={s.id}
                  className={`scenario-button ${trace?.operation.value === s.id && trace.operation.type === "SCENARIO" ? "selected" : ""}`}
                  onClick={() => demo(s.id)}
                  disabled={busy || !session}
                  title={t(
                    "ScenarioSidebar.running_replaces_the_collection_contents",
                    { "0": text.description },
                  )}
                  aria-describedby="scenario-reset-hint"
                >
                  <span className="scenario-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{text.title}</strong>
                    <small>{text.description}</small>
                  </span>
                  <ChevronRight size={14} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className="java-badge">
            J<span>21</span>
          </div>
          <p>
            {t("ScenarioSidebar.java_is_the_source_of_truth")}
            <br />
            <span>{t("ScenarioSidebar.react_is_the_presentation")}</span>
          </p>
        </div>
      </div>
    </aside>
  );
}

import type { Session, CollectionSnapshot } from "../api/types";
export function StateMetrics({
  snapshot,
  session,
  metrics,
  result,
  resultCaption,
}: {
  snapshot?: CollectionSnapshot;
  session: Session | null;
  metrics: { label: string; value: string | number; caption: string }[];
  result: string;
  resultCaption: string;
}) {
  return (
    <>
      <div className="state-label">
        <span>
          <i
            className={
              snapshot?.phase === "WORKING" ? "working-dot" : "committed-dot"
            }
          />
          {snapshot?.phase === "WORKING"
            ? "Рабочий снимок шага"
            : "Зафиксированное состояние"}
        </span>
        {session && (
          <span>
            На сервере: size{" "}
            <b data-testid="committed-size">{session.state.size}</b> · revision{" "}
            {session.revision}
          </span>
        )}
      </div>
      <section className="metrics" aria-label="Показатели состояния">
        {metrics.map((metric) => (
          <Metric key={metric.label} {...metric} />
        ))}
        <div className="metric result-metric">
          <span>РЕЗУЛЬТАТ ОПЕРАЦИИ</span>
          <strong data-testid="operation-result">{result}</strong>
          <small>{resultCaption} </small>
        </div>
      </section>
    </>
  );
}
function Metric({
  label,
  value,
  caption,
}: {
  label: string;
  value: string | number;
  caption: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong data-testid={`metric-${label}`}>{value}</strong>
      <small>{caption}</small>
    </div>
  );
}

import { valueLabel, type Session, type Snapshot, type Trace } from "../types";
export function StateMetrics({
  snapshot,
  session,
  trace,
}: {
  snapshot?: Snapshot;
  session: Session | null;
  trace?: Trace;
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
        <Metric
          label="size"
          value={snapshot?.size ?? "—"}
          caption="количество записей"
        />
        <Metric
          label="capacity"
          value={snapshot?.capacity ?? "—"}
          caption={
            snapshot?.capacity === 0
              ? "массив не выделен"
              : "выделенных бакетов"
          }
        />
        <Metric
          label="threshold"
          value={snapshot?.threshold ?? "—"}
          caption={
            snapshot?.capacity === 0 && snapshot.threshold > 0
              ? "целевая начальная ёмкость"
              : "resize при size > threshold"
          }
        />
        <Metric
          label="loadFactor"
          value={snapshot?.loadFactor ?? ".75"}
          caption="коэффициент загрузки"
        />
        <div className="metric result-metric">
          <span>РЕЗУЛЬТАТ ОПЕРАЦИИ</span>
          <strong data-testid="operation-result">
            {trace ? resultText(trace) : "Готов к работе"}
          </strong>
          <small>
            {trace
              ? trace.result.found
                ? "ключ найден в коллекции"
                : "операция выполнена Java-движком"
              : "начните с put или сценария"}
          </small>
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
function resultText(trace: Trace) {
  const type = trace.operation.type;
  if (type === "GET")
    return trace.result.found
      ? valueLabel(trace.result.value)
      : "null · не найден";
  if (type === "PUT")
    return trace.result.found
      ? `было ${valueLabel(trace.result.previousValue)}`
      : "null · новый ключ";
  if (type === "REMOVE")
    return trace.result.found
      ? `удалено ${valueLabel(trace.result.previousValue)}`
      : "null · не найден";
  if (type === "SCENARIO") return `${trace.committed.size} записей · готово`;
  return type === "CLEAR" ? "Коллекция очищена" : "Новая коллекция";
}

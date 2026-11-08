import {
  elementLabel,
  isArray,
  valueLabel,
  type Session,
  type CollectionSnapshot,
  type Trace,
} from "../types";
export function StateMetrics({
  snapshot,
  session,
  trace,
}: {
  snapshot?: CollectionSnapshot;
  session: Session | null;
  trace?: Trace;
}) {
  const array = snapshot && isArray(snapshot);
  const map = snapshot && !isArray(snapshot) ? snapshot : undefined;
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
              : array
                ? "выделенных ячеек"
                : "выделенных бакетов"
          }
        />
        <Metric
          label={array ? "free" : "threshold"}
          value={
            array ? snapshot.capacity - snapshot.size : (map?.threshold ?? "—")
          }
          caption={
            map?.capacity === 0 && map.threshold > 0
              ? "целевая начальная ёмкость"
              : array
                ? "свободных позиций"
                : "resize при size > threshold"
          }
        />
        <Metric
          label={array ? "buffer" : "loadFactor"}
          value={array ? `#${snapshot.buffer.id}` : (map?.loadFactor ?? ".75")}
          caption={array ? "учебная версия массива" : "коэффициент загрузки"}
        />
        <div className="metric result-metric">
          <span>РЕЗУЛЬТАТ ОПЕРАЦИИ</span>
          <strong data-testid="operation-result">
            {trace ? resultText(trace) : "Готов к работе"}
          </strong>
          <small>
            {trace
              ? trace.collection === "HASH_MAP" && trace.result.found
                ? "ключ найден в коллекции"
                : "операция выполнена Java-движком"
              : array
                ? "начните с add или сценария"
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
  if (trace.collection === "ARRAY_LIST") {
    const r = trace.result;
    if (r.kind === "ELEMENT" && r.element) return elementLabel(r.element);
    if (r.kind === "INT") return String(r.intValue);
    if (r.kind === "BOOLEAN") return String(r.booleanValue);
    return r.kind === "RESET" ? "Новая коллекция" : "void";
  }
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

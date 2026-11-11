export function StateMetrics({
  metrics,
  result,
  resultCaption,
}: {
  metrics: { label: string; value: string | number; caption: string }[];
  result: string;
  resultCaption: string;
}) {
  return (
    <section className="metrics" aria-label="Показатели состояния">
      {metrics.map((metric) => (
        <div className="metric" key={metric.label} title={metric.caption}>
          <span>{metric.label}</span>
          <strong data-testid={`metric-${metric.label}`}>{metric.value}</strong>
          <small className="sr-only">{metric.caption}</small>
        </div>
      ))}
      <div
        className="metric result-metric"
        title={`${result} · ${resultCaption}`}
      >
        <span>Результат операции</span>
        <div className="result-value">
          <strong data-testid="operation-result">{result}</strong>
        </div>
        <small className="sr-only">{resultCaption}</small>
      </div>
    </section>
  );
}

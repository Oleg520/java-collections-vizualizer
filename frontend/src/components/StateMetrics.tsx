import { useI18n } from "../i18n/LocaleProvider";
export function StateMetrics({
  metrics,
  result,
  resultCaption,
}: {
  metrics: { label: string; value: string | number; caption: string }[];
  result: string;
  resultCaption: string;
}) {
  const { t } = useI18n();
  return (
    <section className="metrics" aria-label={t("StateMetrics.state_metrics")}>
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
        <span>{t("StateMetrics.operation_result")}</span>
        <div className="result-value">
          <strong data-testid="operation-result">{result}</strong>
        </div>
        <small className="sr-only">{resultCaption}</small>
      </div>
    </section>
  );
}

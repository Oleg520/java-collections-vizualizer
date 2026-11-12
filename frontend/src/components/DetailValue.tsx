/** Show the fields supplied by Java without inferring a result from truthiness or null. */
type Model = "result" | "element" | "key";
export function DetailValue({
  value,
  model,
  label = (key) => key,
}: {
  value: unknown;
  model?: Model;
  label?: (key: string) => string;
}) {
  if (value === null) return <code>null</code>;
  if (Array.isArray(value)) {
    return value.length ? (
      <ol className="detail-array">
        {value.map((item, index) => (
          <li key={index}>
            <DetailValue value={item} />
          </li>
        ))}
      </ol>
    ) : (
      <code>[]</code>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    return entries.length ? (
      <dl className="detail-object">
        {entries.map(([key, item]) => (
          <div
            key={key}
            className={
              item !== null && typeof item === "object"
                ? "structured-detail"
                : undefined
            }
          >
            <dt>{model ? label(key) : key}</dt>
            <dd>
              <DetailValue
                value={item}
                label={label}
                model={
                  model === "result" && key === "element"
                    ? "element"
                    : undefined
                }
              />
            </dd>
          </div>
        ))}
      </dl>
    ) : (
      <code>{"{}"}</code>
    );
  }
  return (
    <code>
      {typeof value === "string" ? JSON.stringify(value) : String(value)}
    </code>
  );
}

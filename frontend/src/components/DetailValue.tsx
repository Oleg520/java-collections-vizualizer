/** Show the fields supplied by Java without inferring a result from truthiness or null. */
export function DetailValue({ value }: { value: unknown }) {
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
            <dt>{key}</dt>
            <dd>
              <DetailValue value={item} />
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

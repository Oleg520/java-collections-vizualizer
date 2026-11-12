import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DetailValue } from "./DetailValue";

const render = (value: unknown) =>
  renderToStaticMarkup(<DetailValue value={value} />);

it.each([
  [null, "null"],
  [false, "false"],
  [true, "true"],
  [0, "0"],
  ["null", "&quot;null&quot;"],
  ["", "&quot;&quot;"],
  [{}, "{}"],
  [[], "[]"],
])("preserves the Java detail value %j", (value, text) => {
  expect(render(value)).toBe(`<code>${text}</code>`);
});

it.each([
  { kind: "BOOLEAN", booleanValue: false, element: null },
  { kind: "INT", intValue: 0, element: null },
  { kind: "ELEMENT", element: { type: "NULL", value: null } },
  { kind: "ELEMENT", element: { type: "INTEGER", value: "0" } },
  { kind: "VOID", element: null },
  { kind: "RESET", element: null },
  { found: true, previousValue: null, value: "Java" },
])("keeps nested result fields and explicit nulls: %j", (result) => {
  const markup = render(result);
  for (const [key, value] of Object.entries(result)) {
    expect(markup).toContain(`<dt>${key}</dt><dd>${render(value)}</dd>`);
  }
  expect(markup).toContain('class="detail-object"');
});

it("renders arrays structurally and escapes user-controlled strings", () => {
  const markup = render([
    "<script>alert('x')</script>",
    { type: "STRING", value: "null" },
  ]);
  expect(markup).toContain('<ol class="detail-array"><li>');
  expect(markup).toContain("&lt;script&gt;");
  expect(markup).not.toContain("<script>");
  expect(markup).toContain(
    "<dt>value</dt><dd><code>&quot;null&quot;</code></dd>",
  );
});

it("localizes known nested protocol labels and preserves arbitrary strings and extension objects", async () => {
  const { fieldLabel } = await import("../i18n/fields");
  const { translate } = await import("../i18n/locale");
  const value = {
    kind: "ELEMENT",
    element: { type: "STRING", value: "Значение {count} <script>" },
    extension: { value: "Данные" },
  };
  const before = JSON.stringify(value);
  const markup = renderToStaticMarkup(
    <DetailValue
      value={value}
      model="result"
      label={(key) =>
        fieldLabel((key, params) => translate("en", key, params), key)
      }
    />,
  );
  expect(markup).toContain("Kind · kind");
  expect(markup).toContain("Element · element");
  expect(markup).toContain("Type · type");
  expect(markup).toContain("Значение {count} &lt;script&gt;");
  expect(markup).toContain("<dt>value</dt>");
  expect(JSON.stringify(value)).toBe(before);
});

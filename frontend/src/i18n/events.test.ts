import { expect, it } from "vitest";
import { eventExplanation, eventMessages } from "./events";
import type { Step } from "../api/types";
const step = (event: string, details: Record<string, unknown> = {}): Step => ({
  event,
  details,
  message: "This must never be parsed",
  index: 0,
  stage: "tree",
  operation: { type: "PUT", key: null, value: null },
  snapshot: {} as Step["snapshot"],
});
it("translates every registered event without reading its message or changing data", () => {
  for (const [key, pair] of Object.entries(eventMessages)) {
    expect(pair[0].trim()).not.toBe("");
    expect(pair[1].trim()).not.toBe("");
    if (!key.includes(".")) {
      const source = step(key);
      const before = JSON.stringify(source);
      expect(eventExplanation("ru", source)).toContain(pair[0]);
      expect(eventExplanation("en", source)).toContain(pair[1]);
      expect(JSON.stringify(source)).toBe(before);
    }
  }
});
it("distinguishes Java recoloring reasons and insertion contexts", () => {
  expect(
    eventExplanation("en", step("TREE_RECOLORED", { reason: "RED_UNCLE" })),
  ).toContain("Red uncle");
  expect(
    eventExplanation("en", step("TREE_RECOLORED", { reason: "ROOT_BLACK" })),
  ).toBe("Root colored black");
  expect(
    eventExplanation("en", step("NODE_INSERTED", { context: "CHAIN_APPEND" })),
  ).toContain("chain");
  expect(
    eventExplanation("en", step("UNTREEIFIED", { reason: "REMOVAL_SHAPE" })),
  ).toContain("shape");
  expect(
    eventExplanation("en", step("UNTREEIFIED", { reason: "SPLIT_COUNT" })),
  ).toContain("≤ 6");
});
it("uses a localized fallback for unknown Java events", () => {
  expect(eventExplanation("en", step("FUTURE_EVENT"))).toBe(
    "Java event: FUTURE_EVENT",
  );
  expect(eventExplanation("ru", step("FUTURE_EVENT"))).toBe(
    "Событие Java: FUTURE_EVENT",
  );
});

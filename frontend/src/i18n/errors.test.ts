import { expect, it } from "vitest";
import { ApiError } from "../api/api";
import { errorText, ClientError } from "./errors";
import { translate } from "./locale";
const en = (
  key: Parameters<typeof translate>[1],
  params?: Record<string, unknown>,
) => translate("en", key, params);
it("renders structured server reasons and retains cooldown information", () => {
  const error = new ApiError(
    "Непрозрачный серверный текст",
    400,
    "INVALID_INPUT",
    12345,
    "INDEX_RANGE",
    { index: 7, size: 2 },
  );
  expect(errorText(en, { cause: error })).toBe(
    "Index out of bounds: 7; size = 2",
  );
  expect(error.retryAt).toBe(12345);
});
it("does not expose raw backend messages for older or unknown responses", () => {
  for (const reason of [undefined, "FUTURE_REASON", "constructor"]) {
    expect(
      errorText(en, {
        cause: new ApiError(
          "Секретные данные",
          400,
          "INVALID_INPUT",
          0,
          reason,
        ),
      }),
    ).toBe("Check operation arguments, their types and allowed ranges.");
  }
  expect(errorText(en, { cause: new Error("Неизвестные данные") })).toBe(
    "The request failed. Refresh the state before continuing.",
  );
});
it("translates retained errors and recovery context at rendering time", () => {
  const descriptor = {
    cause: new ApiError("original", 0, "NETWORK_ERROR"),
    refresh: true,
  };
  expect(errorText(en, descriptor)).toContain(
    "Current state has not been obtained",
  );
  expect(
    errorText((key, params) => translate("ru", key, params), descriptor),
  ).toContain("Актуальное состояние");
  expect(
    errorText(en, { cause: new ClientError("errors.corruptReference") }),
  ).toBe("Corrupt trace reference");
  expect(errorText(en, { cause: null, expired: true })).toContain(
    "session expired",
  );
});

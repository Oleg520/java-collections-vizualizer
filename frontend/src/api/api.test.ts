import { afterEach, expect, it, vi } from "vitest";
import { api, ApiError, retryDeadline } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("parses Retry-After seconds and HTTP dates without inventing deadlines", () => {
  const now = Date.parse("Tue, 10 Nov 2026 10:00:00 GMT");
  expect(retryDeadline("12", now)).toBe(now + 12000);
  expect(retryDeadline("Tue, 10 Nov 2026 10:00:15 GMT", now)).toBe(now + 15000);
  expect(retryDeadline("Mon, 09 Nov 2026 10:00:00 GMT", now)).toBe(now);
  expect(retryDeadline("invalid", now)).toBe(0);
  expect(retryDeadline(null, now)).toBe(0);
});

it.each([429, 503])(
  "preserves the cooldown on HTTP %s with a non-JSON body",
  async (status) => {
    const before = Date.now();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("proxy unavailable", {
          status,
          headers: { "Retry-After": "3" },
        }),
      ),
    );
    const error = await api.get("tab").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(status);
    expect(error.retryAt).toBeGreaterThanOrEqual(before + 3000);
    expect(error.message).toMatch(/Java-сервис/);
  },
);

it("bounds a stalled body, not just the response headers", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const deadline = vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init: RequestInit) => ({
      text: () =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener("abort", () =>
            reject(new Error("body timeout")),
          );
        }),
    })),
  );
  const result = api.get("tab").catch((e) => e);
  await vi.advanceTimersByTimeAsync(15000);
  expect((await result).code).toBe("NETWORK_ERROR");
  expect(deadline).toHaveBeenCalledWith(15000);
  vi.useRealTimers();
});

it("treats malformed success JSON as uncertain and gives actionable route errors", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(new Response("<html>OK</html>"))
      .mockResolvedValueOnce(new Response("Not found", { status: 404 })),
  );
  await expect(api.get("tab")).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
    status: 0,
  });
  await expect(api.get("tab")).rejects.toThrow("совместимость версий");
});

it("retains HTTP rejection and Retry-After when reading the error body fails", async () => {
  const now = Date.now();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "60" }),
      text: vi.fn().mockRejectedValue(new Error("body disconnected")),
    }),
  );
  const error = await api.get("tab").catch((e) => e);
  expect(error.status).toBe(429);
  expect(error.retryAt).toBeGreaterThanOrEqual(now + 60000);
});

it("checks backend capability before any create or mutation and never falls back to an old protocol", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ status: "UP", version: "old" })),
    );
  vi.stubGlobal("fetch", fetch);
  await expect(api.create()).rejects.toMatchObject({
    status: 426,
    code: "API_VERSION_MISMATCH",
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toContain("/health");
  expect(fetch.mock.calls[0][1].method).toBe("GET");
});

it("retains additive validation metadata without requiring it from older servers", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            code: "INVALID_INPUT",
            message: "legacy",
            reason: "INDEX_RANGE",
            params: { index: 7, size: 2 },
          }),
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            code: "INVALID_INPUT",
            message: "legacy",
          }),
          { status: 400 },
        ),
      ),
  );
  await expect(api.get("tab")).rejects.toMatchObject({
    code: "INVALID_INPUT",
    reason: "INDEX_RANGE",
    params: { index: 7, size: 2 },
  });
  const legacy = await api.get("tab").catch((e) => e);
  expect(legacy.reason).toBeUndefined();
  expect(legacy.params).toBeUndefined();
});

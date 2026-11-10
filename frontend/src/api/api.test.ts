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

import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("uses the configured site origin and preserves the complete API path", async () => {
  vi.stubEnv("VITE_API_URL", "https://visualizer.devport.ru");
  vi.resetModules();
  const fetch = vi.fn().mockResolvedValue(new Response("[]"));
  vi.stubGlobal("fetch", fetch);
  const { api } = await import("./api");
  await api.scenarios("ARRAY_LIST");
  expect(fetch.mock.calls[0][0]).toBe(
    "https://visualizer.devport.ru/api/v1/scenarios?collection=ARRAY_LIST",
  );
});

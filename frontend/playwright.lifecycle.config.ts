import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "session-lifecycle.spec.ts",
  webServer: (base.webServer as { command: string }[]).map((server) => ({
    ...server,
    // Strict budgets reproduce the original failures; never reuse the broad-suite backend.
    reuseExistingServer: false,
    ...(server.command.includes("make backend")
      ? {
          env: {
            MAX_SESSIONS: "32",
            MAX_SESSIONS_PER_CLIENT: "0",
            SESSION_CREATE_RATE_LIMIT: "6",
            WORK_RATE_LIMIT: "120",
            TRUSTED_PROXIES: "127.0.0.1,::1",
          },
        }
      : {}),
  })),
});

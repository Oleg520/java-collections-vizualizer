import { defineConfig, devices } from "@playwright/test";

const preview = process.env.E2E_PREVIEW === "1";
const port = preview ? 4173 : 5173;

export default defineConfig({
  // One worker runs both viewports, including real 15s recovery and playback regressions.
  globalTimeout: 300000,
  testDir: "./e2e",
  testIgnore: "session-lifecycle.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1080 },
      },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command:
        'cd .. && "${JAVA_HOME:+$JAVA_HOME/bin/}java" -jar "$(sh scripts/backend-jar.sh)"',
      // The suite creates many isolated sessions from one localhost client.
      // Production limits remain unchanged and are covered by API limit tests.
      env: {
        MAX_SESSIONS: "256",
        MAX_SESSIONS_PER_CLIENT: "256",
        SESSION_CREATE_RATE_LIMIT: "256",
        WORK_RATE_LIMIT: "5000",
      },
      url: "http://127.0.0.1:8080/api/v1/health",
      reuseExistingServer: !process.env.CI,
      timeout: 90000,
    },
    {
      command: `npm run ${preview ? "preview" : "dev"} -- --port ${port} --strictPort`,
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});

import { defineConfig, devices } from "@playwright/test";

const preview = process.env.E2E_PREVIEW === "1";
const port = preview ? 4173 : 5173;

export default defineConfig({
  globalTimeout: 180000,
  testDir: "./e2e",
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
      command: "cd .. && make backend",
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

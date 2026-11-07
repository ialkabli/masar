import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "ui.spec.ts",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:8343", headless: true },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:8343/api/health",
    reuseExistingServer: !process.env.CI,
    env: { DATABASE_URL: "./data/e2e" },
  },
});

const { defineConfig, devices } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./testing/browser",
  testMatch: "*.spec.js",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/browser-results.json" }],
  ],
  outputDir: "test-results/artifacts",
  use: {
    baseURL: "http://127.0.0.1:5179",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node testing/browser/server.js",
    url: "http://127.0.0.1:5179/_test/ready",
    reuseExistingServer: false,
    timeout: 60000,
  },
});

const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './test/browser', workers: 1, retries: 0, timeout: 30000,
  reporter: 'list', use: { browserName: 'chromium', headless: true },
});

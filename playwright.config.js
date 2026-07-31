import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3001',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'node scripts/admin.js',
    port: 3001,
    reuseExistingServer: true
  }
});

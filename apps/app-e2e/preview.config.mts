import { defineConfig, devices } from '@playwright/test';

// Isolated UI preview: no backend, database, credentials or auth fixtures needed.
export default defineConfig({
  testDir: './preview-tests',
  outputDir: './test-output/preview',
  use: { baseURL: 'http://127.0.0.1:4202', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm exec next dev apps/app --hostname 127.0.0.1 --port 4202',
    cwd: '../..',
    url: 'http://127.0.0.1:4202',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
});

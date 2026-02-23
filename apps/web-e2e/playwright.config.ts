import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:3000';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  /* Shared settings for all the projects below. */
  use: {
    baseURL,
    trace: 'retain-on-failure', // Keep trace for all failures, not just retries
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000, // Increased from 10s for better reliability
    navigationTimeout: 30000,
  },
  timeout: 60000,
  expect: {
    timeout: 15000, // Increased from 10s for web-first assertions
  },
  forbidOnly: !!process.env.CI,
  /* No retries — each test creates isolated state, failures should be real */
  retries: process.env.CI ? 1 : 0,
  /* Run tests sequentially: each test creates its own user via testUtils */
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'test-output/playwright/report' }],
    ['json', { outputFile: 'test-output/playwright/results.json' }],
    ['junit', { outputFile: 'test-output/playwright/results.xml' }],
    ['list'],
  ],
  /* Start the Next.js dev server before running tests */
  webServer: {
    command: 'npx nx run @zuko/web:dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    cwd: workspaceRoot,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

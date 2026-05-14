import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '.env') });

// Mirror feature flags into the Playwright process so test.skip conditions work
process.env.MEETINGS_ENABLED = 'true';

import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

const baseURL = process.env['BASE_URL'] || 'http://localhost:3000';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  /* Files run in parallel (workers); tests within each file run sequentially */
  fullyParallel: false,
  workers: 2,
  use: {
    baseURL,
    headless: !!process.env.CI, // Open browser locally; headless in CI
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
  reporter: [
    ['html', { outputFolder: 'test-output/playwright/report' }],
    ['json', { outputFile: 'test-output/playwright/results.json' }],
    ['junit', { outputFile: 'test-output/playwright/results.xml' }],
    ['list'],
  ],
  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'nx dev @zuko/web',
      url: 'http://localhost:3000/sign-in',
      name: 'Frontend',
      reuseExistingServer: !process.env.CI,
      cwd: workspaceRoot,
      timeout: 1000 * 60 * 60, // 60 minutes timeout for frontend startup
      // In CI, ignore dev server output to keep logs readable; locally pipe for debugging
      stdout: process.env.CI ? 'ignore' : 'pipe',
      stderr: process.env.CI ? 'ignore' : 'pipe',
      env: {
        ...process.env,
        BACKEND_URL: process.env.BACKEND_URL ?? 'http://localhost:3001',
        NEXT_PUBLIC_USE_AUTH_PROXY:
          process.env.NEXT_PUBLIC_USE_AUTH_PROXY ?? 'true',
        NEXT_PUBLIC_BETTER_AUTH_INCLUDE_EMAILS_AUTH: 'true',
        NEXT_PUBLIC_APP_URL:
          process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
        NEXT_PUBLIC_BACKEND_URL:
          process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001',
        NODE_ENV: 'test',
        MEETINGS_ENABLED: 'true',
        SPRITES_API_BASE_URL: 'https://api.sprites.dev',
      },
    },
  ],
  projects: [
    // 1. Auth setup: sign up once, save .auth/user.json
    {
      name: 'auth setup',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/auth.setup.spec.ts',
    },
    // 2. All e2e specs (each file creates its own data at top)
    {
      name: 'e2e',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, '.auth', 'user.json'),
      },
      testIgnore: ['**/auth.setup.spec.ts'],
      dependencies: ['auth setup'],
    },
  ],
});

import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { getReadyUrl, workspaceRoot } from '@nx/devkit';
import { APP_URL, BACKEND_URL, testDatabaseUrl } from './src/support/env.js';

const isCI = !!process.env['CI'];
// For CI, you may want to set BASE_URL to the deployed application.
// getReadyUrl moves the address to the port the dev server task reported.
const baseURL = process.env['BASE_URL'] || getReadyUrl(APP_URL);

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import 'dotenv/config';

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Generated as a .mts file so Node forces ESM regardless of workspace
 * `type`. Playwright routes `.mts` through its ESM loader (dynamic import,
 * bypassing the pirates CJS-compile path), and Nx's native TS strip loads
 * `.mts` directly. Playwright's configLoader auto-discovers
 * `playwright.config.mts` via its extension list
 * (.ts/.js/.mts/.mjs/.cts/.cjs).
 */
export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  webServer: [
    {
      // Backend against the dedicated test database. Migrations run first;
      // `prisma migrate deploy` also creates the database if it is missing.
      // Reuse is safe: BACKEND_URL is an e2e-only port, so anything on it uses zuko_test.
      command:
        'pnpm --filter @zuko/backend exec prisma migrate deploy && pnpm exec nx run @zuko/backend:serve',
      url: `${BACKEND_URL}/api`,
      reuseExistingServer: true,
      // Nx starts the server in its own process group, which Playwright's default
      // SIGKILL cannot reach. SIGINT (like Ctrl-C) lets Nx stop its child cleanly; SIGTERM works too but prints Nx "tasks stopped" warnings.
      gracefulShutdown: { signal: 'SIGINT', timeout: 10_000 },
      timeout: 120_000,
      cwd: workspaceRoot,
      env: {
        DATABASE_URL: testDatabaseUrl(),
        BETTER_AUTH_SECRET: 'e2e-only-secret-not-for-real-use-0123456789',
        BACKEND_URL,
        FRONTEND_URL: APP_URL,
        PORT: new URL(BACKEND_URL).port,
      },
    },
    {
      command: isCI ? 'pnpm exec nx run @zuko/app:start' : 'pnpm exec nx run @zuko/app:dev',
      url: getReadyUrl(APP_URL),
      reuseExistingServer: true,
      gracefulShutdown: { signal: 'SIGINT', timeout: 10_000 },
      timeout: 120_000,
      cwd: workspaceRoot,
      env: { PORT: new URL(APP_URL).port, NEXT_PUBLIC_BACKEND_URL: BACKEND_URL },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Uncomment for mobile browsers support
    /* {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    }, */

    // Uncomment for branded browsers
    /* {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    } */
  ],
});

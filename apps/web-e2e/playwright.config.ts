import * as path from 'path';
import * as dotenv from 'dotenv';

// Load web-e2e .env so webServer and auth fixture use same DATABASE_URL / BETTER_AUTH_SECRET
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });

import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

const baseURL = process.env['BASE_URL'] || 'http://localhost:3000';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  /* Shared settings for all the projects below. */
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
  /* Run tests sequentially: each test creates its own user via testUtils */
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'test-output/playwright/report' }],
    ['json', { outputFile: 'test-output/playwright/results.json' }],
    ['junit', { outputFile: 'test-output/playwright/results.xml' }],
    ['list'],
  ],
  /* Run your local dev server before starting the tests */
  webServer: [
    // Backend server - must start first
    {
      command: 'nx serve @zuko/backend',
      url: 'http://localhost:3001/api',
      name: 'Backend',
      reuseExistingServer: !process.env.CI, // Don't reuse in CI to ensure clean state
      cwd: workspaceRoot,
      timeout: 1000 * 60 * 10, // 10 minutes timeout for backend startup
      stdout: 'pipe', // Show backend logs in console for debugging
      stderr: 'pipe',
      env: {
        ...process.env,
        PORT: process.env.PORT ?? '3001',
        DATABASE_URL: process.env.DATABASE_URL ?? '',
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
        GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ?? '',
        GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ?? '',
        BETTER_AUTH_INCLUDE_EMAILS_AUTH: 'true',
      },
    },
    // Frontend server. When reusing (local), auth redirect test needs the running app
    // to have NEXT_PUBLIC_USE_AUTH_PROXY=true (set in apps/web/.env) so get-session
    // goes to 3000/auth and cookies are sent. In CI we don't reuse so env is applied.
    {
      command: 'nx dev @zuko/web',
      url: 'http://localhost:3000/sign-in',
      name: 'Frontend',
      reuseExistingServer: !process.env.CI,
      cwd: workspaceRoot,
      timeout: 1000 * 60 * 60, // 60 minutes timeout for frontend startup
      stdout: 'pipe', // Show frontend logs in console for debugging
      stderr: 'pipe',
      env: {
        ...process.env,
        BACKEND_URL: process.env.BACKEND_URL ?? 'http://localhost:3001',
        NEXT_PUBLIC_USE_AUTH_PROXY:
          process.env.NEXT_PUBLIC_USE_AUTH_PROXY ?? 'true',
        NEXT_PUBLIC_BETTER_AUTH_INCLUDE_EMAILS_AUTH: 'true',
        NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
        NEXT_PUBLIC_BACKEND_URL: 'http://localhost:3001',
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
    // 2. Data: empty state checks + create contact, company, deal (runs after auth)
    {
      name: 'data',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json',
      },
      testMatch: '**/data.spec.ts',
      dependencies: ['auth setup'],
    },
    // 3. Contacts, companies, deals, contact-activities: all depend on data
    {
      name: 'contacts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json',
      },
      testMatch: '**/contacts.spec.ts',
      dependencies: ['data'],
    },
    {
      name: 'companies',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json',
      },
      testMatch: '**/companies.spec.ts',
      dependencies: ['data'],
    },
    {
      name: 'deals',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json',
      },
      testMatch: '**/deals.spec.ts',
      dependencies: ['data'],
    },
    {
      name: 'contact-activities',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json',
      },
      testMatch: '**/contact-activities.spec.ts',
      dependencies: ['data'],
    },
    // 4. All other tests (chat, settings, roles, auth, etc.)
    {
      name: 'e2e',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json',
      },
      testIgnore: [
        '**/auth.setup.spec.ts',
        '**/data.spec.ts',
        '**/contacts.spec.ts',
        '**/companies.spec.ts',
        '**/deals.spec.ts',
        '**/contact-activities.spec.ts',
      ],
      dependencies: ['data'],
    },
  ],
});

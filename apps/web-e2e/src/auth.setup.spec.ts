import { test as base } from '@playwright/test';
import * as path from 'path';

/**
 * Auth setup: sign in as the seeded E2E user and save storage state.
 * The "e2e" project uses storageState: '.auth/user.json', so all E2E specs run as this user.
 *
 * Requires the database to be seeded first so the E2E user and org exist:
 *   nx run @zuko/models:seed
 * (Seed creates e2e@example.com, org "e2e-org", and TEST CONTACT / TEST COMPANY / etc.)
 */
const E2E_USER_EMAIL = 'e2e@example.com';
const E2E_USER_PASSWORD = 'TestPassword123!';

const test = base.extend<object>({});

test.describe('Auth setup', () => {
  test('sign in as seeded E2E user and save storage state for authenticated tests', async ({
    page,
  }) => {
    await page.goto('/sign-in');

    await page.getByLabel(/email/i).fill(E2E_USER_EMAIL);
    await page.getByLabel(/^password$/i).fill(E2E_USER_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for app (chat, contacts, or org create if first time)
    await page.waitForURL(
      (url) =>
        !url.pathname.startsWith('/sign-in') && !url.pathname.startsWith('/sign-up'),
      { timeout: 60000 }
    );

    const authDir = path.join(__dirname, '..', '.auth');
    await page
      .context()
      .storageState({ path: path.join(authDir, 'user.json') });
  });
});

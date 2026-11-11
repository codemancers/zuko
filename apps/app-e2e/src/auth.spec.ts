import { expect, test, type APIRequestContext } from '@playwright/test';
import { APP_URL, BACKEND_URL } from './support/env';

const password = 'e2e-test-password-123';

// Unique per call so tests can run in parallel and re-run without cleanup.
function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

// Create a user straight through the API, so login tests don't depend on the sign-up page.
async function createUser(request: APIRequestContext, email: string) {
  const response = await request.post(`${BACKEND_URL}/auth/sign-up/email`, {
    headers: { origin: APP_URL },
    data: { email, password, name: 'E2E User' },
  });
  expect(response.ok()).toBe(true);
}

test.describe('authentication', () => {
  test('a signed-out visitor sees "Not signed in" on the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Not signed in' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  });

  test('sign up, stay signed in across a reload, then sign out', async ({ page }) => {
    const email = uniqueEmail();

    await page.goto('/signup');
    await page.getByLabel('Name').fill('E2E User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(email)).toBeVisible();

    // The session cookie is set by the backend (:3100) and read from the app (:4201).
    await page.reload();
    await expect(page.getByText(email)).toBeVisible();

    await page.getByRole('button', { name: 'Open user menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Not signed in' })).toBeVisible();
  });

  test('log in with the right password', async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(email)).toBeVisible();
  });

  test('a wrong password shows an error and keeps the typed email', async ({ page, request }) => {
    const email = uniqueEmail();
    await createUser(request, email);

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('not-the-password');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.locator('main [role="alert"]')).toHaveText('Invalid email or password');
    await expect(page.getByLabel('Email')).toHaveValue(email);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('signing up with an existing email shows an error and keeps the typed name', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail();
    await createUser(request, email);

    await page.goto('/signup');
    await page.getByLabel('Name').fill('Someone Else');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(page.locator('main [role="alert"]')).toContainText('already exists');
    await expect(page.getByLabel('Name')).toHaveValue('Someone Else');
    await expect(page).toHaveURL(/\/signup$/);
  });
});

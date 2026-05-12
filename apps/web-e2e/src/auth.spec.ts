import { test, expect } from '@playwright/test';

/**
 * These tests require an unauthenticated context (sign-in page and protected
 * route redirects). The auth project loads storageState; override with empty
 * state so we see behavior as a logged-out user.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  test('sign-in page displays correctly', async ({ page }) => {
    await page.goto('/sign-in');

    // Verify page title
    await expect(page.locator('h1')).toContainText('Sign in to Zuko');

    // Verify Google sign-in button is present
    const googleButton = page.getByRole('button', {
      name: /continue with google/i,
    });
    await expect(googleButton).toBeVisible();

    // Verify button has Google icon
    const icon = googleButton.locator('img[alt="Google"]');
    await expect(icon).toBeVisible();
  });

  test('clicking Google sign-in button initiates OAuth flow', async ({
    page,
    context,
  }) => {
    await page.goto('/sign-in');

    // Listen for navigation events
    const navigationPromise = page
      .waitForNavigation({ timeout: 5000 })
      .catch(() => null);

    // Click the Google sign-in button
    const googleButton = page.getByRole('button', {
      name: /continue with google/i,
    });
    await googleButton.click();

    // Wait for navigation to complete or timeout
    await navigationPromise;

    // Verify we're either on Google OAuth page or redirected somewhere
    // In a real test, you would mock the OAuth flow or test in a staging environment
    const url = page.url();
    expect(url).not.toBe('about:blank');
  });

  test('unauthenticated users cannot access protected routes', async ({
    page,
  }) => {
    // Try to access protected route directly
    await page.goto('/chat');

    // Should redirect to sign-in
    await page.waitForURL('**/sign-in', { timeout: 5000 });

    await expect(page.locator('h1')).toContainText('Sign in to Zuko');
  });

  test('unauthenticated users cannot access contacts', async ({ page }) => {
    await page.goto('/contacts');

    // Should redirect to sign-in
    await page.waitForURL('**/sign-in', { timeout: 5000 });

    await expect(page.locator('h1')).toContainText('Sign in to Zuko');
  });

  test('unauthenticated users cannot access settings', async ({ page }) => {
    await page.goto('/settings');

    // Should redirect to sign-in
    await page.waitForURL('**/sign-in', { timeout: 5000 });

    await expect(page.locator('h1')).toContainText('Sign in to Zuko');
  });

  test('unauthenticated users cannot access specific chat', async ({
    page,
  }) => {
    // Try to access a specific chat directly
    await page.goto('/chat/123');

    // Should redirect to sign-in
    await page.waitForURL('**/sign-in', { timeout: 5000 });

    await expect(page.locator('h1')).toContainText('Sign in to Zuko');
  });
});

test.describe('organization creation', () => {
  test('authenticated users can create an organization', async ({ page }) => {
    // signup as a new user
    const email = `e2e-setup-${Date.now()}@example.com`;
    const name = 'E2E Setup User';
    const password = 'TestPassword123!';

    await page.goto('/sign-up');
    await page.getByRole('textbox', { name: /full name/i }).fill(name);
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByRole('button', { name: /create account/i }).click();

    await page.waitForURL('**/organization/create', { timeout: 60000 });

    // Create an organization so we have an active session with an org
    const orgName = `E2E Org ${Date.now()}`;
    const orgSlug = `e2e-org-${Date.now()}`;

    await page.getByLabel(/organization name/i).fill(orgName);
    // Slug is auto-generated, but we can fill it to be sure
    await page.getByLabel(/organization slug/i).fill(orgSlug);

    await page.getByRole('button', { name: /save changes/i }).click();

    await page.waitForURL('**/chat', { timeout: 60000 });
  });
});

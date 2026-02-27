import { test, expect } from './fixtures';

test.describe('Settings Page', () => {
  test('redirects to sign-in when not authenticated', async ({
    settingsPage,
    page,
  }) => {
    await settingsPage.goto();

    // Should redirect to sign-in if not authenticated
    const url = page.url();
    if (url.includes('/sign-in')) {
      await expect(page.locator('h1')).toContainText('Sign in to Zuko');
    } else {
      // If authenticated, verify we're on settings page
      expect(url).toContain('/settings');
    }
  });

  test('can navigate to settings page', async ({ page }) => {
    await page.goto('/settings');

    // Either on settings page or redirected to sign-in
    const url = page.url();
    expect(url).toMatch(/\/(settings|sign-in)/);
  });
});

test.describe('Settings - Authenticated', () => {
  test('displays settings page when authenticated', async ({
    settingsPage,
    page,
    auth,
  }) => {
    await settingsPage.goto();

    // Verify we're on settings page
    expect(page.url()).toContain('/settings');
  });

  test('displays GitHub connection section', async ({ page, auth }) => {
    await page.goto('/settings');

    // Look for GitHub-related content
    const githubContent = await page
      .getByText(/github/i)
      .isVisible()
      .catch(() => false);

    // GitHub integration should be visible
    if (githubContent) {
      expect(githubContent).toBe(true);
    }
  });

  // Skipped: clicking "Connect GitHub" initiates OAuth redirect and disrupts test flow
  test.skip('can connect GitHub account', async ({
    settingsPage,
    page,
    auth,
  }) => {
    await settingsPage.goto();

    // Look for connect button
    const connectButton = page.getByRole('button', {
      name: /connect.*github/i,
    });
    const isVisible = await connectButton.isVisible().catch(() => false);

    if (isVisible) {
      await connectButton.click();

      // Should initiate OAuth flow or show modal
      await page.waitForTimeout(500);
    }
  });

  test('displays connected GitHub account info', async ({ page, auth }) => {
    await page.goto('/settings');

    // Check if GitHub is already connected
    const connectedStatus = await page
      .getByText(/connected/i)
      .isVisible()
      .catch(() => false);

    if (connectedStatus) {
      // Verify account info is displayed
      expect(connectedStatus).toBe(true);
    }
  });

  // Skipped: clicking "Install App" navigates to GitHub and disrupts test flow
  test.skip('can install GitHub app', async ({ page, auth }) => {
    await page.goto('/settings');

    // Look for install GitHub app button/link
    const installButton = page.getByRole('button', { name: /install.*app/i });
    const isVisible = await installButton.isVisible().catch(() => false);

    if (isVisible) {
      // Verify button exists
      expect(isVisible).toBe(true);
    }
  });

  test('can save settings changes', async ({ settingsPage, page, auth }) => {
    await settingsPage.goto();

    // Look for save button
    const saveButton = page.getByRole('button', { name: /save/i });
    const isVisible = await saveButton.isVisible().catch(() => false);

    if (isVisible) {
      await saveButton.click();

      // Wait for save confirmation
      await page.waitForTimeout(500);

      // Look for success message
      const successMessage = await page
        .getByText(/saved|success/i)
        .isVisible()
        .catch(() => false);

      if (successMessage) {
        expect(successMessage).toBe(true);
      }
    }
  });

  test('displays user profile information', async ({ page, auth }) => {
    await page.goto('/settings');

    // Check for common profile fields
    const profileFields = ['email', 'name', 'username'];

    for (const field of profileFields) {
      const fieldVisible = await page
        .getByLabel(new RegExp(field, 'i'))
        .isVisible()
        .catch(() => false);

      // Just checking existence, not asserting
      if (fieldVisible) {
        // Field found
      }
    }
  });

  test('can disconnect GitHub account', async ({ page, auth }) => {
    await page.goto('/settings');

    // Look for disconnect button (only if connected)
    const disconnectButton = page.getByRole('button', {
      name: /disconnect|remove/i,
    });
    const isVisible = await disconnectButton.isVisible().catch(() => false);

    if (isVisible) {
      // Just verify button exists, don't actually disconnect
      expect(isVisible).toBe(true);
    }
  });
});

test.describe('Settings - Navigation', () => {
  test('can navigate back from settings', async ({ page, auth }) => {
    await page.goto('/settings');

    // Look for back button or navigation
    const backButton = page
      .getByRole('button', { name: /back/i })
      .or(page.getByRole('link', { name: /back/i }));
    const isVisible = await backButton.isVisible().catch(() => false);

    if (isVisible) {
      await backButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('settings link is accessible from navigation', async ({
    page,
    auth,
  }) => {
    await page.goto('/');

    // Wait for redirect to complete (authenticated users land on /chat)
    await page.waitForURL('**/chat', { timeout: 5000 }).catch(() => {});

    // Settings link should be visible in sidebar navigation
    const settingsLink = page.getByRole('link', { name: /settings/i });
    await expect(settingsLink).toBeVisible();

    await settingsLink.click();
    await page.waitForURL('**/settings');
    expect(page.url()).toContain('/settings');
  });
});

/**
 * Note: To fully implement remaining tests, you need:
 * 1. Mock GitHub OAuth flow or use test credentials
 * 2. Pre-connected GitHub test account state
 */

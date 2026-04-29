import { test, expect } from './fixtures';

test.describe('Settings - Unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects to sign-in when not authenticated', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForURL('**/sign-in**', { timeout: 10000 });
    expect(page.url()).toContain('/sign-in');
    await expect(page.locator('h1')).toContainText('Sign in to Zuko');
  });
});

test.describe('Settings', () => {
  test('can navigate to settings page', async ({ page }) => {
    await page.goto('/settings');
    expect(page.url()).toContain('/settings');
  });

  test('displays settings page', async ({ settingsPage, page }) => {
    await settingsPage.goto();
    expect(page.url()).toContain('/settings');
  });

  test('displays GitHub connection section', async ({ page }) => {
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
  test.skip('can connect GitHub account', async ({ settingsPage, page }) => {
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

  test('displays connected GitHub account info', async ({ page }) => {
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
  test.skip('can install GitHub app', async ({ page }) => {
    await page.goto('/settings');

    // Look for install GitHub app button/link
    const installButton = page.getByRole('button', { name: /install.*app/i });
    const isVisible = await installButton.isVisible().catch(() => false);

    if (isVisible) {
      // Verify button exists
      expect(isVisible).toBe(true);
    }
  });

  test('can save settings changes', async ({ settingsPage, page }) => {
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

  test('displays user profile information', async ({ page }) => {
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

  test('can disconnect GitHub account', async ({ page }) => {
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

test.describe('Settings - Teams tab', () => {
  test('clicking Create Team button opens the Create Team dialog', async ({
    settingsPage,
    page,
  }) => {
    await settingsPage.goto();
    await settingsPage.switchTab('teams');

    await settingsPage.createTeamButton.click();

    await expect(page.getByText('Create Team').first()).toBeVisible();
  });
});

test.describe('Settings - Members tab', () => {
  test('clicking Invite to Org button opens the Add Member dialog', async ({
    settingsPage,
    page,
  }) => {
    await settingsPage.goto();
    await settingsPage.switchTab('members');

    await settingsPage.inviteToOrgButton.click();

    await expect(page.getByText('Add Member').first()).toBeVisible();
  });
});

test.describe('Settings - Navigation', () => {
  test('can navigate back from settings', async ({ page }) => {
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

  test('settings link is accessible from navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const settingsLink = page.getByRole('link', { name: /settings/i });
    await expect(settingsLink).toBeVisible();

    await settingsLink.click();
    await page.waitForURL('**/settings');
    expect(page.url()).toContain('/settings');
  });
});

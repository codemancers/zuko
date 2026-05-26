import { test, expect } from './fixtures';

test.describe('Apollo.io Integration - Unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects to sign-in when accessing settings unauthenticated', async ({
    page,
  }) => {
    await page.goto('/settings');
    await page.waitForURL('**/sign-in**', { timeout: 10000 });
    expect(page.url()).toContain('/sign-in');
  });
});

test.describe('Apollo.io Integration - Connections tab', () => {
  test('displays Apollo.io in the integrations table', async ({
    settingsPage,
    page,
  }) => {
    await settingsPage.goto();
    await settingsPage.switchTab('connections');

    await expect(page.getByText(/apollo\.io/i).first()).toBeVisible();
  });

  test('displays Apollo.io connection status', async ({
    settingsPage,
    page,
  }) => {
    await settingsPage.goto();
    await settingsPage.switchTab('connections');

    const apolloRow = page.getByRole('row', { name: /apollo/i });
    await expect(apolloRow).toBeVisible();

    // Row should show either Connected or Disconnected badge
    const status = apolloRow.getByText(/connected|disconnected/i).first();
    await expect(status).toBeVisible();
  });

  test('shows Connect button when Apollo is not connected', async ({
    settingsPage,
    page,
  }) => {
    await settingsPage.goto();
    await settingsPage.switchTab('connections');

    const apolloRow = page.getByRole('row', { name: /apollo/i });
    const isDisconnected = await apolloRow
      .getByText(/disconnected/i)
      .isVisible()
      .catch(() => false);

    if (isDisconnected) {
      await expect(settingsPage.apolloConnectButton).toBeVisible();
    }
  });

  test('shows Disconnect and Reconnect buttons when Apollo is connected', async ({
    settingsPage,
    page,
  }) => {
    await settingsPage.goto();
    await settingsPage.switchTab('connections');

    const apolloRow = page.getByRole('row', { name: /apollo/i });
    const isConnected = await apolloRow
      .getByText(/^connected$/i)
      .isVisible()
      .catch(() => false);

    if (isConnected) {
      await expect(settingsPage.apolloDisconnectButton).toBeVisible();
      await expect(settingsPage.apolloReconnectButton).toBeVisible();
    }
  });

  test(
    'clicking Connect redirects to Apollo OAuth authorization screen',
    { tag: '@external' },
    async ({ settingsPage, page }) => {
      await settingsPage.goto();
      await settingsPage.switchTab('connections');

      const isDisconnected = await page
        .getByRole('row', { name: /apollo/i })
        .getByText(/disconnected/i)
        .isVisible()
        .catch(() => false);

      if (!isDisconnected) {
        test.skip();
        return;
      }

      await settingsPage.apolloConnectButton.click();

      await page.waitForURL(/app\.apollo\.io.*oauth\/authorize/, {
        timeout: 15000,
      });

      const url = page.url();
      expect(url).toContain('app.apollo.io');
      expect(url).toContain('oauth/authorize');
      expect(url).toContain('client_id=');
      expect(url).toContain('code_challenge=');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('state=');
    },
  );

  test('can disconnect Apollo when connected', async ({
    settingsPage,
    page,
  }) => {
    await settingsPage.goto();
    await settingsPage.switchTab('connections');

    const apolloRow = page.getByRole('row', { name: /apollo/i });
    const isConnected = await apolloRow
      .getByText(/^connected$/i)
      .isVisible()
      .catch(() => false);

    if (isConnected) {
      await settingsPage.apolloDisconnectButton.click();

      // Should show success toast
      await expect(page.getByText(/apollo disconnected/i)).toBeVisible({
        timeout: 5000,
      });

      // Status should update to disconnected
      await expect(apolloRow.getByText(/disconnected/i)).toBeVisible({
        timeout: 5000,
      });
    }
  });
});

test.describe('Apollo.io Integration - OAuth callback', () => {
  test('shows success toast after successful Apollo connection', async ({
    page,
  }) => {
    await page.context().addCookies([
      {
        name: '_apollo_flash',
        value: 'success',
        path: '/',
        domain: 'localhost',
      },
    ]);
    await page.goto('/settings');

    await expect(
      page.getByText(/Apollo\.io connected successfully/i),
    ).toBeVisible({ timeout: 8000 });

    // Flash cookie should be cleared after reading
    const cookie = await page.evaluate(() =>
      document.cookie.includes('_apollo_flash'),
    );
    expect(cookie).toBe(false);
  });

  test('shows error toast after failed Apollo connection', async ({ page }) => {
    await page.context().addCookies([
      {
        name: '_apollo_flash',
        value: 'error:access_denied',
        path: '/',
        domain: 'localhost',
      },
    ]);
    await page.goto('/settings');

    await expect(page.getByText(/failed to connect apollo\.io/i)).toBeVisible({
      timeout: 8000,
    });

    // Flash cookie should be cleared after reading
    const cookie = await page.evaluate(() =>
      document.cookie.includes('_apollo_flash'),
    );
    expect(cookie).toBe(false);
  });
});

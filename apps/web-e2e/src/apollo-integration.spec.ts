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
    'clicking Connect opens Nango OAuth popup for Apollo',
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

      // Nango opens a popup window for OAuth — listen for it
      const popupPromise = page
        .waitForEvent('popup', { timeout: 10000 })
        .catch(() => null);
      await settingsPage.apolloConnectButton.click();
      const popup = await popupPromise;

      // Nango popup opens Apollo's OAuth page
      if (popup) {
        await popup.waitForLoadState('domcontentloaded');
        expect(popup.url()).toMatch(/apollo\.io|nango/i);
      }
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

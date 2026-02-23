import { test, expect } from './fixtures';

/**
 * Authentication Redirect Test
 * Tests that authenticated users are redirected to /chat page
 * Uses better-auth test-utils helpers for authentication via the auth fixture
 */
test.describe('Auth Redirect - Using Test Utils', () => {
  test('authenticated user should be redirected to /chat from homepage', async ({ page, auth }) => {
    // auth fixture has already injected signed session cookies into the page context
    await page.goto('http://localhost:3000');

    // Wait for potential redirect
    await page.waitForURL('**/chat', { timeout: 5000 });

    // Verify we're on the chat page
    expect(page.url()).toContain('/chat');

    // Verify chat UI is visible (chat page has a textarea for input)
    await expect(page.getByRole('textbox', { name: /ask anything/i })).toBeVisible();
  });

  test('unauthenticated user should NOT be redirected to /chat', async ({ page }) => {
    // Navigate to homepage without authentication
    await page.goto('http://localhost:3000');

    // Should stay on homepage or be redirected to sign-in
    await page.waitForTimeout(1000);

    // Should NOT be on chat page
    expect(page.url()).not.toContain('/chat');
  });
});

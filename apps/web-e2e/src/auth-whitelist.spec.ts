import { test, expect } from '@playwright/test';

/**
 * Email Whitelist Tests
 *
 * These tests verify that the email whitelist configuration properly restricts
 * access to the platform. Only whitelisted emails should be able to sign up.
 *
 * Prerequisites:
 * - Email/password authentication must be enabled (NEXT_PUBLIC_BETTER_AUTH_INCLUDE_EMAILS_AUTH=true)
 * - Backend must be running with email whitelist configured
 */

test.describe('Email Whitelist', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to sign-up page
    await page.goto('/sign-up');

    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Create your account');
  });

  test('should reject signup for non-whitelisted email', async ({ page }) => {
    // Check if email/password form is visible
    const emailInput = page.locator('input[type="email"]');

    // Skip test if email auth is not enabled
    if (!(await emailInput.isVisible())) {
      test.skip(true, 'Email/password authentication is not enabled');
      return;
    }

    // Fill in the signup form with non-whitelisted email
    await emailInput.fill('invalid@example.com');
    await page.locator('input[type="password"]').fill('TestPassword123!');
    await page.locator('input[name="name"]').fill('Invalid User');

    // Submit the form and wait for API response
    const submitButton = page.getByRole('button', { name: /create account/i });
    const responsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/sign-up') ||
        resp.url().includes('/api/auth/sign-up'),
      { timeout: 10000 },
    );
    await submitButton.click();
    await responsePromise;

    // Verify error message appears using web-first assertion
    const errorMessage = page.locator('text=/Access is restricted/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Verify the error message contains the whitelist info
    await expect(errorMessage).toContainText('Allowed emails');
  });

  test('should accept signup for whitelisted email vinu.r22@gmail.com', async ({
    page,
  }) => {
    const emailInput = page.locator('input[type="email"]');

    // Skip test if email auth is not enabled
    if (!(await emailInput.isVisible())) {
      test.skip(true, 'Email/password authentication is not enabled');
      return;
    }

    // Fill in the signup form with whitelisted email
    await emailInput.fill('vinu.r22@gmail.com');
    await page.locator('input[type="password"]').fill('TestPassword123!');
    await page.locator('input[name="name"]').fill('Vinu Test');

    // Submit the form and wait for API response
    const submitButton = page.getByRole('button', { name: /create account/i });
    const responsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/sign-up') ||
        resp.url().includes('/api/auth/sign-up'),
      { timeout: 10000 },
    );
    await submitButton.click();
    await responsePromise;

    // Should either redirect to chat (success) or show "user exists" error
    // But should NOT show "Access is restricted" error
    const restrictedError = page.locator('text=/Access is restricted/i');

    // Use toPass to handle both redirect and error cases
    await expect(async () => {
      const url = page.url();
      // Either successfully redirected OR not showing whitelist error
      expect(
        url.includes('/chat') || !(await restrictedError.isVisible()),
      ).toBeTruthy();
    }).toPass({ timeout: 5000 });
  });

  test('should accept signup for whitelisted email yuva@codemancers.com', async ({
    page,
  }) => {
    const emailInput = page.locator('input[type="email"]');

    // Skip test if email auth is not enabled
    if (!(await emailInput.isVisible())) {
      test.skip(true, 'Email/password authentication is not enabled');
      return;
    }

    // Fill in the signup form with whitelisted email
    await emailInput.fill('yuva@codemancers.com');
    await page.locator('input[type="password"]').fill('TestPassword123!');
    await page.locator('input[name="name"]').fill('Yuva Test');

    // Submit the form and wait for API response
    const submitButton = page.getByRole('button', { name: /create account/i });
    const responsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/sign-up') ||
        resp.url().includes('/api/auth/sign-up'),
      { timeout: 10000 },
    );
    await submitButton.click();
    await responsePromise;

    // Should either redirect to chat (success) or show "user exists" error
    // But should NOT show "Access is restricted" error
    const restrictedError = page.locator('text=/Access is restricted/i');

    // Use toPass to handle both redirect and error cases
    await expect(async () => {
      const url = page.url();
      // Either successfully redirected OR not showing whitelist error
      expect(
        url.includes('/chat') || !(await restrictedError.isVisible()),
      ).toBeTruthy();
    }).toPass({ timeout: 5000 });
  });

  test('should reject signup with case variations of non-whitelisted email', async ({
    page,
  }) => {
    const emailInput = page.locator('input[type="email"]');

    // Skip test if email auth is not enabled
    if (!(await emailInput.isVisible())) {
      test.skip(true, 'Email/password authentication is not enabled');
      return;
    }

    // Fill in the signup form with non-whitelisted email (uppercase)
    await emailInput.fill('INVALID@EXAMPLE.COM');
    await page.locator('input[type="password"]').fill('TestPassword123!');
    await page.locator('input[name="name"]').fill('Invalid User Upper');

    // Submit the form and wait for API response
    const submitButton = page.getByRole('button', { name: /create account/i });
    const responsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/sign-up') ||
        resp.url().includes('/api/auth/sign-up'),
      { timeout: 10000 },
    );
    await submitButton.click();
    await responsePromise;

    // Verify error message appears using web-first assertion
    const errorMessage = page.locator('text=/Access is restricted/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should accept signup with case variations of whitelisted email', async ({
    page,
  }) => {
    const emailInput = page.locator('input[type="email"]');

    // Skip test if email auth is not enabled
    if (!(await emailInput.isVisible())) {
      test.skip(true, 'Email/password authentication is not enabled');
      return;
    }

    // Fill in the signup form with whitelisted email (uppercase)
    await emailInput.fill('VINU.R22@GMAIL.COM');
    await page.locator('input[type="password"]').fill('TestPassword123!');
    await page.locator('input[name="name"]').fill('Vinu Upper');

    // Submit the form and wait for API response
    const submitButton = page.getByRole('button', { name: /create account/i });
    const responsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/sign-up') ||
        resp.url().includes('/api/auth/sign-up'),
      { timeout: 10000 },
    );
    await submitButton.click();
    await responsePromise;

    // Should NOT show "Access is restricted" error (use web-first assertion)
    const restrictedError = page.locator('text=/Access is restricted/i');
    await expect(restrictedError).not.toBeVisible({ timeout: 3000 });
  });

  test('should reject multiple different non-whitelisted emails', async ({
    page,
  }) => {
    const emailInput = page.locator('input[type="email"]');

    // Skip test if email auth is not enabled
    if (!(await emailInput.isVisible())) {
      test.skip(true, 'Email/password authentication is not enabled');
      return;
    }

    const invalidEmails = [
      'test@test.com',
      'user@unauthorized.com',
      'random@gmail.com',
      'admin@example.org',
    ];

    for (const email of invalidEmails) {
      // Clear and fill form
      await emailInput.clear();
      await emailInput.fill(email);
      await page.locator('input[type="password"]').fill('TestPassword123!');
      await page.locator('input[name="name"]').fill('Test User');

      // Submit the form and wait for API response
      const submitButton = page.getByRole('button', {
        name: /create account/i,
      });
      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('/sign-up') ||
          resp.url().includes('/api/auth/sign-up'),
        { timeout: 10000 },
      );
      await submitButton.click();
      await responsePromise;

      // Verify error message appears using web-first assertion
      const errorMessage = page.locator('text=/Access is restricted/i');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });

      // Reload page for next iteration
      await page.goto('/sign-up');
      await expect(page.locator('h1')).toContainText('Create your account');
    }
  });
});

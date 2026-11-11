import { expect, test } from '@playwright/test';

test.describe('theme', () => {
  test.describe('follows the OS setting by default', () => {
    test.describe('dark OS', () => {
      test.use({ colorScheme: 'dark' });

      test('uses dark mode', async ({ page }) => {
        await page.goto('/login');
        await expect(page.locator('html')).toHaveClass(/\bdark\b/);
      });
    });

    test.describe('light OS', () => {
      test.use({ colorScheme: 'light' });

      test('uses light mode', async ({ page }) => {
        await page.goto('/login');
        await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
        await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
      });
    });
  });

  test.describe('manual choice', () => {
    test.use({ colorScheme: 'light' });

    async function choose(
      page: import('@playwright/test').Page,
      name: 'Light' | 'Dark' | 'System',
    ) {
      await page.getByRole('button', { name: 'Change theme' }).click();
      await page.getByRole('menuitem', { name }).click();
    }

    test('overrides the OS setting and survives a reload', async ({ page }) => {
      await page.goto('/login');
      await choose(page, 'Dark');
      await expect(page.locator('html')).toHaveClass(/\bdark\b/);

      await page.reload();
      await expect(page.locator('html')).toHaveClass(/\bdark\b/);

      await choose(page, 'Light');
      await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
      await page.reload();
      await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
    });

    test('"System" goes back to following the OS', async ({ page }) => {
      await page.goto('/login');
      await choose(page, 'Dark');
      await expect(page.locator('html')).toHaveClass(/\bdark\b/);

      await choose(page, 'System');
      await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);

      await page.emulateMedia({ colorScheme: 'dark' });
      await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    });
  });
});

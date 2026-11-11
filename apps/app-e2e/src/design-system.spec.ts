import { expect, test } from '@playwright/test';

// The page is `page.dev.tsx`, so it only exists under `next dev`, which is how
// the e2e web server runs the app. `next build` omits it (404 in production).
test('the dev-only design system page renders', async ({ page }) => {
  await page.goto('/design-system');
  await expect(page.getByRole('heading', { name: 'Zuko design system' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Semantic tokens, themed in light and dark' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The parts list' })).toBeVisible();
});

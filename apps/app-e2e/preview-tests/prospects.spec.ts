import { expect, test } from '@playwright/test';

test('preview supports keyboard entry, edit, search and reload without data requests', async ({
  page,
}) => {
  const errors: string[] = [];
  const dataRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (['fetch', 'xhr'].includes(request.resourceType()) && !request.url().includes('_next')) {
      dataRequests.push(request.url());
    }
  });
  await page.goto('/prospects-preview');
  await expect(page.getByText('UI preview · not connected')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'No prospects in this preview yet' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add prospect' }).click();
  await expect(page.getByRole('heading', { name: 'Add prospect' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Name', { exact: true })).toBeFocused();
  await page.keyboard.type('Preview Person');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Example Company');
  await page.keyboard.press('Tab');
  await page.keyboard.type('https://example.com/not-linkedin');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Use an HTTPS LinkedIn profile URL',
  );
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Preview Person');
  await page.getByLabel('LinkedIn URL').fill('https://www.linkedin.com/in/preview-person');
  await page.getByRole('button', { name: 'Add to preview' }).click();
  await expect(page.getByRole('heading', { name: 'Preview Person' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit prospect' }).click();
  await page.getByLabel('Company').fill('Updated Example Company');
  await page.getByRole('button', { name: 'Apply to preview' }).click();
  await expect(page.getByText('Updated Example Company')).toBeVisible();
  await page.getByRole('button', { name: 'Back to prospects' }).click();
  await page.getByLabel('Search prospects').fill('unmatched');
  await expect(page.getByRole('heading', { name: 'No matching prospects' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('button', { name: 'View Preview Person' }).click();
  await expect(page.getByText('Updated Example Company')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'No prospects in this preview yet' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(dataRequests).toEqual([]);
});

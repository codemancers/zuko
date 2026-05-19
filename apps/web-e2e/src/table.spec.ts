import { test, expect } from './fixtures';

/**
 * E2E tests for column reordering via drag-and-drop (dnd-kit).
 * Uses the Contacts table which has columnReordering enabled.
 */

test.describe('Column Reordering - Unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects to sign-in when not authenticated', async ({ page }) => {
    await page.goto('/contacts');
    await page.waitForURL('**/sign-in**', { timeout: 10000 });
    expect(page.url()).toContain('/sign-in');
  });
});

test.describe('Column Reordering', () => {
  test.beforeEach(async ({ contactsPage }) => {
    await contactsPage.goto();
    await expect(
      contactsPage.page.locator('table thead'),
    ).toBeVisible({ timeout: 10000 });
  });

  test('column headers have grab cursor on reorderable columns', async ({
    tablePage,
  }) => {
    const cursor = await tablePage.getColumnCursor('Name');
    expect(cursor).toBe('grab');
  });

  test('pinned S.No column has default cursor and cannot be dragged', async ({
    tablePage,
  }) => {
    const cursor = await tablePage.getColumnCursor('S.No');
    expect(cursor).toBe('default');
  });

  test('dragging a column changes its position', async ({
    tablePage,
  }) => {
    const headersBefore = await tablePage.getColumnHeaders();
    const nameIndex = headersBefore.findIndex((h) => h.trim() === 'Name');
    const emailIndex = headersBefore.findIndex((h) => h.trim() === 'Email');
    expect(nameIndex).toBeGreaterThan(-1);
    expect(emailIndex).toBeGreaterThan(-1);

    await tablePage.dragColumn('Name', 'Email');

    const headersAfter = await tablePage.getColumnHeaders();
    const newNameIndex = headersAfter.findIndex((h) => h.trim() === 'Name');
    expect(newNameIndex).not.toBe(nameIndex);
  });

  test('column order persists after page reload', async ({
    contactsPage,
    tablePage,
  }) => {
    await tablePage.dragColumn('Name', 'Email');
    const headersAfterDrag = await tablePage.getColumnHeaders();

    await contactsPage.goto();
    await expect(
      contactsPage.page.locator('table thead'),
    ).toBeVisible({ timeout: 10000 });

    const headersAfterReload = await tablePage.getColumnHeaders();
    expect(headersAfterReload).toEqual(headersAfterDrag);
  });

  test('S.No column stays first after reordering other columns', async ({
    tablePage,
  }) => {
    await tablePage.dragColumn('Name', 'Email');

    const headers = await tablePage.getColumnHeaders();
    expect(headers[0].trim()).toBe('S.No');
  });
});

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
  test.beforeEach(async ({ contactsPage, page }) => {
    await contactsPage.goto();
    await expect(page.locator('table thead')).toBeVisible({ timeout: 10000 });
  });

  test('column headers have grab cursor on reorderable columns', async ({
    tablePage,
  }) => {
    const cursor = await tablePage.getColumnCursor('Email');
    expect(cursor).toBe('grab');
  });

  test('pinned S.No, Name column has default cursor and cannot be dragged', async ({
    tablePage,
  }) => {
    const cursorSNO = await tablePage.getColumnCursor('S.No');
    expect(cursorSNO).toBe('default');

    const cursorName = await tablePage.getColumnCursor('Name');
    expect(cursorName).toBe('default');
  });

  test('dragging a column changes its position', async ({ tablePage }) => {
    // Initial column order follows : S.No, Name, Email, Phone, Owner
    // Dragging Email column to Phone column position
    const headersBefore = await tablePage.getColumnHeaders();
    const emailIndex = headersBefore.findIndex((h) => h.trim() === 'Email');
    const phoneIndex = headersBefore.findIndex((h) => h.trim() === 'Phone');

    await tablePage.dragColumn('Email', 'Phone');

    const headersAfter = await tablePage.getColumnHeaders();
    const newEmailIndex = headersAfter.findIndex((h) => h.trim() === 'Email');
    const newPhoneIndex = headersAfter.findIndex((h) => h.trim() === 'Phone');

    // Expecting Email column to have new position.
    // Expecting columns after name to shift accordingly.
    expect(newEmailIndex).toBe(phoneIndex);
    expect(newPhoneIndex).toBe(emailIndex);
  });

  test('column order persists after page reload', async ({
    contactsPage,
    tablePage,
    page,
  }) => {
    const headersBefore = await tablePage.getColumnHeaders();
    const emailIndex = headersBefore.findIndex((h) => h.trim() === 'Email');
    const phoneIndex = headersBefore.findIndex((h) => h.trim() === 'Phone');

    await tablePage.dragColumn('Email', 'Phone');
    const headersAfterDrag = await tablePage.getColumnHeaders();
    const newEmailIndex = headersAfterDrag.findIndex(
      (h) => h.trim() === 'Email',
    );
    const newPhoneIndex = headersAfterDrag.findIndex(
      (h) => h.trim() === 'Phone',
    );
    // Expecting Email column to have new position.
    // Expecting columns after Name column to shift accordingly.
    expect(newEmailIndex).toBe(phoneIndex);
    expect(newPhoneIndex).toBe(emailIndex);

    await contactsPage.goto();
    await expect(page.locator('table thead')).toBeVisible({ timeout: 10000 });

    const headersAfterReload = await tablePage.getColumnHeaders();
    expect(headersAfterReload).toEqual(headersAfterDrag);
  });
});

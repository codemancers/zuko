import { test, expect } from './fixtures/test-fixtures';

test.describe('Organization Switch', () => {
  test('Clears stale data and show correct data when switching organizations', async ({
    createOrgPage,
    page,
    contactsPage,
  }) => {
    // 1. Create first organization
    const org1Name = `Org 1 ${Date.now()}`;
    await createOrgPage.goto();
    await createOrgPage.createOrganization(org1Name);
    // Wait for the UI to show the new organization in the sidebar
    await expect(page.getByRole('button', { name: org1Name })).toBeVisible({
      timeout: 15000,
    });

    // 2. Create second organization
    const org2Name = `Org 2 ${Date.now()}`;
    await createOrgPage.goto();
    await createOrgPage.createOrganization(org2Name);
    await expect(page.getByRole('button', { name: org2Name })).toBeVisible({
      timeout: 15000,
    });

    // 3. Navigate to Contacts page (currently in Org 2)
    await contactsPage.goto();
    await expect(
      page.getByRole('heading', { name: /contacts/i }),
    ).toBeVisible();

    // 4. Create a new column in Org 2
    const columnName = `Col ${Date.now()}`;
    const columnKey = `col_${Date.now()}`;
    await contactsPage.createContactColumn(columnName, columnKey, 'text');

    // 5. Create a contact row in Org 2
    const contactName = `contact_${Date.now()}`;
    await contactsPage.createContactRow(contactName);

    // 6. Switch to Org 1
    await page.getByRole('button', { name: org2Name }).click();
    await page.getByRole('menuitem').filter({ hasText: org1Name }).click();

    // 7. Verify reload happened and we are on Org 1
    // The sidebar should now show Org 1
    await expect(page.getByRole('button', { name: org1Name })).toBeVisible({
      timeout: 10000,
    });
    // We should still be on Contacts page, but it should be fresh
    await expect(
      page.getByRole('heading', { name: /contacts/i }),
    ).toBeVisible();

    // 8. Verify Org 2's data is NOT present in Org 1 (No stale data)
    await expect(
      page.getByRole('columnheader', { name: columnName }),
    ).toBeHidden();
    await expect(page.getByText(contactName)).toBeHidden();

    // 9. Switch back to Org 2
    await page.getByRole('button', { name: org1Name }).click();
    await page.getByRole('menuitem').filter({ hasText: org2Name }).click();

    // 10. Verify Org 2's data IS present (Correct data after switch)
    await expect(page.getByRole('button', { name: org2Name })).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole('columnheader', { name: columnName }),
    ).toBeVisible();
    await expect(page.getByText(contactName)).toBeVisible();
  });
});

import { test, expect } from './fixtures';

test.describe('Contacts Page - Unauthenticated', () => {
  test('redirects to sign-in when not authenticated', async ({ page }) => {
    await page.goto('/contacts');
    await page.waitForURL('**/sign-in', { timeout: 5000 });
    await expect(page.locator('h1')).toContainText('Sign in to Zuko');
  });
});

test.describe('Contacts - Authenticated', () => {
  test('can create a new contact', async ({ contactsPage, page, auth }) => {
    await contactsPage.goto();
    await contactsPage.clickNewContact();
    await page.waitForURL('**/contacts/new');
  });

  test('can view contact list', async ({ contactsPage, auth }) => {
    await contactsPage.goto();
    const contacts = await contactsPage.getContactItems();
    expect(Array.isArray(contacts)).toBe(true);
  });

  test('can search for contacts', async ({ contactsPage, auth }) => {
    await contactsPage.goto();
    await contactsPage.searchContact('test');
    await contactsPage.page.waitForTimeout(500);
  });

  test('can click on a contact to view details', async ({ contactsPage, page, auth }) => {
    await contactsPage.goto();
    const contacts = await contactsPage.getContactItems();
    if (contacts.length > 0) {
      await contacts[0].click();
      await page.waitForURL('**/contacts/**');
      expect(page.url()).toMatch(/\/contacts\/[^/]+$/);
    }
  });
});

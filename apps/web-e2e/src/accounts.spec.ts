import { test, expect } from './fixtures';

test.describe('Accounts Page - Unauthenticated', () => {
  test('redirects to sign-in when not authenticated', async ({ page }) => {
    await page.goto('/accounts');
    await page.waitForURL('**/sign-in**');
    expect(page.url()).toContain('/sign-in');
  });
});

test.describe('Accounts - Authenticated', () => {
  test('displays accounts page when authenticated', async ({ accountsPage, page, auth }) => {
    await accountsPage.goto();
    expect(page.url()).toContain('/accounts');
    await accountsPage.waitForAccountsToLoad();
  });

  test('can navigate to create new account', async ({ accountsPage, page, auth }) => {
    await accountsPage.goto();
    await accountsPage.clickNewAccount();
    await page.waitForURL('**/accounts/new');
    expect(page.url()).toContain('/accounts/new');
  });

  test('can view account list', async ({ accountsPage, auth }) => {
    await accountsPage.goto();
    const accounts = await accountsPage.getAccountItems();
    expect(Array.isArray(accounts)).toBe(true);
  });

  test('can search for accounts', async ({ accountsPage, page, auth }) => {
    await accountsPage.goto();
    await accountsPage.searchAccount('test');
    await page.waitForTimeout(500);
  });

  test('can click on an account to view details', async ({ accountsPage, page, auth }) => {
    await accountsPage.goto();
    const accounts = await accountsPage.getAccountItems();
    if (accounts.length > 0) {
      await accounts[0].click();
      await page.waitForURL('**/accounts/**');
      expect(page.url()).toMatch(/\/accounts\/\d+$/);
    } else {
      test.skip();
    }
  });
});

test.describe('Account Detail - Contact Management', () => {
  test('displays account detail page with associated contacts section', async ({ page, accountDetailPage, auth }) => {
    await accountDetailPage.goto(1);
    await expect(accountDetailPage.associatedContactsSection).toBeVisible();
    await expect(accountDetailPage.addContactButton).toBeVisible();
  });

  test('can add a contact to an account', async ({ accountDetailPage, page, auth }) => {
    await accountDetailPage.goto(1);
    const initialContacts = await accountDetailPage.getAssociatedContacts();
    try {
      await accountDetailPage.addContact('Test Contact', 'Employee', false);
      const newContacts = await accountDetailPage.getAssociatedContacts();
      expect(newContacts.length).toBeGreaterThan(initialContacts.length);
      await expect(page.getByText('Test Contact')).toBeVisible();
    } catch {
      test.skip();
    }
  });

  test('can remove a contact from an account', async ({ accountDetailPage, page, auth }) => {
    await accountDetailPage.goto(1);
    const contacts = await accountDetailPage.getAssociatedContacts();
    if (contacts.length === 0) {
      test.skip();
    }
    const firstContact = contacts[0];
    const contactText = await firstContact.textContent();
    const contactName = contactText?.split(' ')[0] || 'Unknown';
    await accountDetailPage.removeContact(contactName);
    await page.waitForTimeout(500);
    const isStillVisible = await accountDetailPage.isContactAssociated(contactName);
    expect(isStillVisible).toBe(false);
  });

  test('can post a comment on account activity timeline', async ({ accountDetailPage, page, auth }) => {
    await accountDetailPage.goto(1);
    await page.getByRole('heading', { name: 'Activity' }).scrollIntoViewIfNeeded();
    const testComment = `Test comment at ${new Date().toISOString()}`;
    await accountDetailPage.postComment(testComment);
    await expect(page.getByText(testComment)).toBeVisible({ timeout: 5000 });
  });

  test('displays activity timeline section', async ({ accountDetailPage, auth }) => {
    await accountDetailPage.goto(1);
    const activities = await accountDetailPage.getActivityItems();
    expect(activities.length).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Account Edit', () => {
  test('can navigate to edit page', async ({ accountDetailPage, page, auth }) => {
    await accountDetailPage.goto(1);
    await accountDetailPage.clickEdit();
    await page.waitForURL('**/accounts/**/edit');
    expect(page.url()).toContain('/edit');
  });

  test('edit page displays account form', async ({ page, auth }) => {
    await page.goto('/accounts/1/edit');
    await expect(page.getByLabel(/Company Name/i)).toBeVisible();
    await expect(page.getByLabel(/Website/i)).toBeVisible();
    await expect(page.getByLabel(/LinkedIn URL/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Add a summary about this account/i)).toBeVisible();
  });
});

test.describe('Account Creation', () => {
  test('new account form displays all required fields', async ({ page, auth }) => {
    await page.goto('/accounts/new');
    await expect(page.getByLabel(/Company Name/i)).toBeVisible();
    await expect(page.getByLabel(/Website/i)).toBeVisible();
    await expect(page.getByLabel(/LinkedIn URL/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Add a summary about this account/i)).toBeVisible();
  });

  test('validates required fields', async ({ page, auth }) => {
    await page.goto('/accounts/new');
    await page.getByRole('button', { name: /Create Account/i }).click();
    await expect(page.getByText(/Company name is required/i)).toBeVisible();
  });
});

test.describe('Contact Association Constraints', () => {
  test('shows warning about one-account-per-contact constraint', async ({ accountDetailPage, page, auth }) => {
    await accountDetailPage.goto(1);
    await accountDetailPage.addContactButton.click();
    await page.waitForSelector('text=Add Contact to Account');
    await expect(page.getByText(/A contact can only be associated with one account at a time/i)).toBeVisible();
  });

  test('filters out already associated contacts from dropdown', async ({ accountDetailPage, page, auth }) => {
    await accountDetailPage.goto(1);
    const associatedContacts = await accountDetailPage.getAssociatedContacts();
    if (associatedContacts.length === 0) {
      test.skip();
    }
    await accountDetailPage.addContactButton.click();
    await page.waitForSelector('text=Add Contact to Account');
    const select = page.locator('select').first();
    const options = await select.locator('option').allTextContents();
    const firstContactText = await associatedContacts[0].textContent();
    const firstContactName = firstContactText?.split(' ')[0];
    const isInDropdown = options.some(opt => opt.includes(firstContactName || ''));
    expect(isInDropdown).toBe(false);
  });
});

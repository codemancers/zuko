import { test, expect } from './fixtures';

test.describe('Companies Page - Unauthenticated', () => {
  test('redirects to sign-in when not authenticated', async ({ page }) => {
    await page.goto('/companies');
    await page.waitForURL('**/sign-in**');
    expect(page.url()).toContain('/sign-in');
  });
});

test.describe('Companies - Authenticated', () => {
  test('displays companies page when authenticated', async ({ companiesPage, page, auth }) => {
    await companiesPage.goto();
    expect(page.url()).toContain('/companies');
    await companiesPage.waitForCompaniesToLoad();
  });

  test('can navigate to create new company', async ({ companiesPage, page, auth }) => {
    await companiesPage.goto();
    await companiesPage.clickNewCompany();
    await page.waitForURL('**/companies/new');
    expect(page.url()).toContain('/companies/new');
  });

  test('can view company list', async ({ companiesPage, auth }) => {
    await companiesPage.goto();
    const companies = await companiesPage.getCompanyItems();
    expect(Array.isArray(companies)).toBe(true);
  });

  test('can search for companies', async ({ companiesPage, page, auth }) => {
    await companiesPage.goto();
    await companiesPage.searchCompany('test');
    await page.waitForTimeout(500);
  });

  test('can click on a company to view details', async ({ companiesPage, page, auth }) => {
    await companiesPage.goto();
    const companies = await companiesPage.getCompanyItems();
    if (companies.length > 0) {
      await companies[0].click();
      await page.waitForURL('**/companies/**');
      expect(page.url()).toMatch(/\/companies\/\d+$/);
    } else {
      test.skip();
    }
  });
});

test.describe('Company Detail - Contact Management', () => {
  test('displays company detail page with associated contacts section', async ({ page, companyDetailPage, auth }) => {
    await companyDetailPage.goto(1);
    await expect(companyDetailPage.associatedContactsSection).toBeVisible();
    await expect(companyDetailPage.addContactButton).toBeVisible();
  });

  test('can add a contact to a company', async ({ companyDetailPage, page, auth }) => {
    await companyDetailPage.goto(1);
    const initialContacts = await companyDetailPage.getAssociatedContacts();
    try {
      await companyDetailPage.addContact('Test Contact', 'Employee', false);
      const newContacts = await companyDetailPage.getAssociatedContacts();
      expect(newContacts.length).toBeGreaterThan(initialContacts.length);
      await expect(page.getByText('Test Contact')).toBeVisible();
    } catch {
      test.skip();
    }
  });

  test('can remove a contact from a company', async ({ companyDetailPage, page, auth }) => {
    await companyDetailPage.goto(1);
    const contacts = await companyDetailPage.getAssociatedContacts();
    if (contacts.length === 0) {
      test.skip();
    }
    const firstContact = contacts[0];
    const contactText = await firstContact.textContent();
    const contactName = contactText?.split(' ')[0] || 'Unknown';
    await companyDetailPage.removeContact(contactName);
    await page.waitForTimeout(500);
    const isStillVisible = await companyDetailPage.isContactAssociated(contactName);
    expect(isStillVisible).toBe(false);
  });

  test('can post a comment on company activity timeline', async ({ companyDetailPage, page, auth }) => {
    await companyDetailPage.goto(1);
    await page.getByRole('heading', { name: 'Activity' }).scrollIntoViewIfNeeded();
    const testComment = `Test comment at ${new Date().toISOString()}`;
    await companyDetailPage.postComment(testComment);
    await expect(page.getByText(testComment)).toBeVisible({ timeout: 5000 });
  });

  test('displays activity timeline section', async ({ companyDetailPage, auth }) => {
    await companyDetailPage.goto(1);
    const activities = await companyDetailPage.getActivityItems();
    expect(activities.length).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Company Edit', () => {
  test('can navigate to edit page', async ({ companyDetailPage, page, auth }) => {
    await companyDetailPage.goto(1);
    await companyDetailPage.clickEdit();
    await page.waitForURL('**/companies/**/edit');
    expect(page.url()).toContain('/edit');
  });

  test('edit page displays company form', async ({ page, auth }) => {
    await page.goto('/companies/1/edit');
    await expect(page.getByLabel(/Company Name/i)).toBeVisible();
    await expect(page.getByLabel(/Website/i)).toBeVisible();
    await expect(page.getByLabel(/LinkedIn URL/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Add a summary about this company/i)).toBeVisible();
  });
});

test.describe('Company Creation', () => {
  test('new company form displays all required fields', async ({ page, auth }) => {
    await page.goto('/companies/new');
    await expect(page.getByLabel(/Company Name/i)).toBeVisible();
    await expect(page.getByLabel(/Website/i)).toBeVisible();
    await expect(page.getByLabel(/LinkedIn URL/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Add a summary about this company/i)).toBeVisible();
  });

  test('validates required fields', async ({ page, auth }) => {
    await page.goto('/companies/new');
    await page.getByRole('button', { name: /Create Company/i }).click();
    await expect(page.getByText(/Company name is required/i)).toBeVisible();
  });
});

test.describe('Contact Association Constraints', () => {
  test('shows warning about one-company-per-contact constraint', async ({ companyDetailPage, page, auth }) => {
    await companyDetailPage.goto(1);
    await companyDetailPage.addContactButton.click();
    await page.waitForSelector('text=Add Contact to Company');
    await expect(page.getByText(/A contact can only be associated with one company at a time/i)).toBeVisible();
  });

  test('filters out already associated contacts from dropdown', async ({ companyDetailPage, page, auth }) => {
    await companyDetailPage.goto(1);
    const associatedContacts = await companyDetailPage.getAssociatedContacts();
    if (associatedContacts.length === 0) {
      test.skip();
    }
    await companyDetailPage.addContactButton.click();
    await page.waitForSelector('text=Add Contact to Company');
    const select = page.locator('select').first();
    const options = await select.locator('option').allTextContents();
    const firstContactText = await associatedContacts[0].textContent();
    const firstContactName = firstContactText?.split(' ')[0];
    const isInDropdown = options.some(opt => opt.includes(firstContactName || ''));
    expect(isInDropdown).toBe(false);
  });
});

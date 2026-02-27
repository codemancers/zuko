import { test, expect } from './fixtures';

/**
 * Data spec: empty state checks and seed data creation for e2e.
 * Creates one contact, one company, and one deal so that contacts.spec,
 * companies.spec, deals.spec and contact-activities.spec can run in parallel.
 */
test.describe('Data setup - empty states', () => {
  test('contacts list shows empty state', async ({ contactsPage, page }) => {
    await contactsPage.goto();
    await expect(page.getByText(/No Contacts/i)).toBeVisible({ timeout: 10000 });
  });

  test('companies list shows empty state', async ({ companiesPage, page }) => {
    await companiesPage.goto();
    await expect(page.getByText(/No Companies/i)).toBeVisible({ timeout: 10000 });
  });

  test('deals list shows empty state', async ({ page }) => {
    await page.goto('/deals');
    await expect(page.getByText(/No Deals/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Data setup - creation', () => {
  test('creates a contact', async ({ contactsPage, page }) => {
    await contactsPage.goto();
    await contactsPage.clickNewContact();
    await page.waitForURL('**/contacts/new', { timeout: 10000 });
    expect(page.url()).toContain('/contacts/new');

    await page.getByLabel(/Name/i).fill('Test E2E Contact');
    await page.getByLabel(/Email/i).fill('test-e2e-contact@example.com');
    await page.getByLabel(/Phone/i).fill('+14155552671');
    await page
      .getByLabel(/LinkedIn ID/i)
      .fill('https://linkedin.com/in/teste2econtact');
    await page
      .getByPlaceholder(/Add notes about this contact.../i)
      .fill('Test E2E Notes');
    await page.getByRole('button', { name: /Create Contact/i }).click();
    await page.waitForURL('**/contacts', { timeout: 10000 });
    expect(page.url()).toContain('/contacts');

    await expect(page.getByText('Test E2E Contact')).toBeVisible({
      timeout: 10000,
    });
  });

  test('creates a company', async ({ companiesPage, page }) => {
    await companiesPage.goto();
    await companiesPage.clickNewCompany();
    await page.waitForURL('**/companies/new', { timeout: 10000 });
    expect(page.url()).toContain('/companies/new');

    await page.getByLabel(/Company Name/i).fill('Test E2E Company');
    await page.getByLabel(/Website/i).fill('https://teste2ecompany.com');
    await page
      .getByLabel(/LinkedIn URL/i)
      .fill('https://linkedin.com/company/teste2ecompany');
    await page
      .getByPlaceholder(/Add a summary about this company/i)
      .fill('Test summary');
    await page.getByRole('button', { name: /Create Company/i }).click();

    await page.waitForURL('**/companies', { timeout: 10000 });
    expect(page.url()).toContain('/companies');

    await expect(page.getByText('Test E2E Company')).toBeVisible({
      timeout: 10000,
    });
  });

  test('creates a deal', async ({ page }) => {
    await page.goto('/deals/new');

    await page.getByLabel(/Deal Title/i).fill('Test Deal');
    await page.getByLabel(/Deal Value/i).fill('100000');
    await page.getByLabel(/Currency/i).selectOption('USD');
    await page.getByLabel(/Stage/i).selectOption('prospecting');
    await page.getByLabel(/Win Probability/i).fill('50');
    await page.getByLabel(/Expected Close Date/i).fill('2026-01-01');
    await page.getByLabel(/Priority/i).selectOption({ value: '2' });
    await page.getByLabel(/Source/i).fill('Test Source');
    await page.getByPlaceholder(/Add notes about this deal/i).fill('Test Summary');
    await page.getByRole('button', { name: /Create Deal/i }).click();

    await page.waitForURL('**/deals/**');
    expect(page.url()).toContain('/deals');

    await expect(page.getByText(/Test Deal/i)).toBeVisible({ timeout: 10000 });
  });
});

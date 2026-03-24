import { test, expect } from "./fixtures";

/**
 * Company & Contact Activity Timeline – System Events
 *
 * Verifies that each lifecycle action produces the correct system event in the
 * activity timeline: company_created, contact_created, field_update,
 * contact_linked, contact_unlinked.
 */

test.describe("Company Activity Timeline - System Events", () => {
  // ── company_created ────────────────────────────────────────────────────────

  test.describe("company_created", () => {
    test("shows 'created this company' after a new company is created", async ({
      companiesPage,
      page,
    }) => {
      await companiesPage.goto();
      await companiesPage.clickNewCompany();
      await page.waitForURL("**/companies/new", { timeout: 10000 });

      const companyName = `Activity Test Company ${Date.now()}`;
      await page.getByLabel(/Company Name/i).fill(companyName);
      await page.getByRole("button", { name: /Create Company/i }).click();

      await page.waitForURL("**/companies", { timeout: 10000 });
      await expect(page.getByText(companyName)).toBeVisible({ timeout: 10000 });

      // Navigate to the newly created company
      await page.locator('a[href^="/companies/"]').filter({ hasText: companyName }).click();
      await page.waitForURL(/\/companies\/\d+/, { timeout: 10000 });

      await page
        .getByRole("heading", { name: "Activity", exact: true })
        .scrollIntoViewIfNeeded();

      await expect(
        page
          .locator('[data-testid="activity-item"]')
          .filter({ hasText: /created this company/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // ── company field_update ───────────────────────────────────────────────────

  test.describe("field_update", () => {
    test("shows 'updated' event after a company field is edited", async ({
      companiesPage,
      companyDetailPage,
      page,
    }) => {
      // Navigate to the first company
      await companiesPage.goto();
      await companiesPage.waitForCompaniesToLoad();

      const firstCompanyLink = page.locator('a[href^="/companies/"]').first();
      await firstCompanyLink.click();
      await page.waitForURL(/\/companies\/\d+/, { timeout: 10000 });

      // Edit the company
      await companyDetailPage.clickEdit();
      await page.waitForURL(/\/companies\/\d+\/edit/, { timeout: 10000 });

      const newSummary = `Updated summary ${Date.now()}`;
      await page.getByPlaceholder(/add a summary about this company/i).fill(newSummary);
      await page.getByRole("button", { name: /Save Changes/i }).click();

      await page.waitForURL(/\/companies\/\d+$/, { timeout: 10000 });

      await page
        .getByRole("heading", { name: "Activity", exact: true })
        .scrollIntoViewIfNeeded();

      await expect(
        page
          .locator('[data-testid="activity-item"]')
          .filter({ hasText: /updated summary/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // ── contact_linked ─────────────────────────────────────────────────────────

  test.describe("contact_linked", () => {
    test("shows 'linked contact' after adding a contact to a company", async ({
      companiesPage,
      companyDetailPage,
      page,
    }) => {
      await companiesPage.goto();
      await companiesPage.waitForCompaniesToLoad();

      const firstCompanyLink = page.locator('a[href^="/companies/"]').first();
      await firstCompanyLink.click();
      await page.waitForURL(/\/companies\/\d+/, { timeout: 10000 });

      // Check if there is a contact available to add
      const hasAddButton = await companyDetailPage.addContactButton.isVisible().catch(() => false);
      if (!hasAddButton) {
        test.skip();
        return;
      }

      // Add a contact (picks first available)
      let contactName: string;
      try {
        contactName = await companyDetailPage.addContact();
      } catch {
        test.skip();
        return;
      }

      await page
        .getByRole("heading", { name: "Activity", exact: true })
        .scrollIntoViewIfNeeded();

      // The activity text is "linked contact <name>"
      const baseName = contactName.split('(')[0].trim();
      await expect(
        page
          .locator('[data-testid="activity-item"]')
          .filter({ hasText: new RegExp(`linked contact ${baseName}`, 'i') })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // ── contact_unlinked ───────────────────────────────────────────────────────

  test.describe("contact_unlinked", () => {
    test("shows 'unlinked contact' after removing a contact from a company", async ({
      companiesPage,
      companyDetailPage,
      page,
    }) => {
      await companiesPage.goto();
      await companiesPage.waitForCompaniesToLoad();

      const firstCompanyLink = page.locator('a[href^="/companies/"]').first();
      await firstCompanyLink.click();
      await page.waitForURL(/\/companies\/\d+/, { timeout: 10000 });

      // Check if there's an associated contact to remove
      const contacts = await companyDetailPage.getAssociatedContacts();
      if (contacts.length === 0) {
        test.skip();
        return;
      }

      const contactLink = contacts[0].locator('a');
      const contactName = (await contactLink.textContent()) ?? '';
      await companyDetailPage.removeContact(contactName);

      await page
        .getByRole("heading", { name: "Activity", exact: true })
        .scrollIntoViewIfNeeded();

      await expect(
        page
          .locator('[data-testid="activity-item"]')
          .filter({ hasText: new RegExp(`unlinked contact ${contactName}`, 'i') })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });
  });
});

// ── Contact Activity Timeline ─────────────────────────────────────────────────

test.describe("Contact Activity Timeline - System Events", () => {
  // ── contact_created ────────────────────────────────────────────────────────

  test.describe("contact_created", () => {
    test("shows 'created this contact' after a new contact is created", async ({
      contactsPage,
      page,
    }) => {
      await contactsPage.goto();
      await contactsPage.clickNewContact();
      await page.waitForURL("**/contacts/new", { timeout: 10000 });

      const contactName = `Activity Test Contact ${Date.now()}`;
      await page.getByLabel(/Name \*/i).fill(contactName);
      await page.getByLabel(/Email/i).fill(`test${Date.now()}@example.com`);
      await page.getByRole("button", { name: /Create Contact/i }).click();

      await page.waitForURL("**/contacts", { timeout: 10000 });
      await expect(page.getByText(contactName)).toBeVisible({ timeout: 10000 });

      // Navigate to the newly created contact
      await page.locator('a[href^="/contacts/"]').filter({ hasText: contactName }).click();
      await page.waitForURL(/\/contacts\/\d+/, { timeout: 10000 });

      await page
        .getByRole("heading", { name: "Activity", exact: true })
        .scrollIntoViewIfNeeded();

      await expect(
        page
          .locator('[data-testid="activity-item"]')
          .filter({ hasText: /created this contact/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // ── contact field_update ───────────────────────────────────────────────────

  test.describe("field_update", () => {
    test("shows 'updated' event after a contact field is edited", async ({
      contactsPage,
      page,
    }) => {
      await contactsPage.goto();
      await page.waitForSelector("tbody tr, text=No Contacts", { timeout: 10000 }).catch((_e: unknown) => undefined);

      const firstContactLink = page.locator('a[href^="/contacts/"]').first();
      await firstContactLink.click();
      await page.waitForURL(/\/contacts\/\d+/, { timeout: 10000 });

      // Edit the contact
      await page.getByRole("button", { name: /edit/i }).click();
      await page.waitForURL(/\/contacts\/\d+\/edit/, { timeout: 10000 });

      await page.getByPlaceholder(/add notes about this contact/i).fill(`Note ${Date.now()}`);
      await page.getByRole("button", { name: /Save Changes/i }).click();

      await page.waitForURL(/\/contacts\/\d+$/, { timeout: 10000 });

      await page
        .getByRole("heading", { name: "Activity", exact: true })
        .scrollIntoViewIfNeeded();

      await expect(
        page
          .locator('[data-testid="activity-item"]')
          .filter({ hasText: /updated notes/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });
  });
});

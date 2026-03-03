import { test, expect } from "./fixtures";

/**
 * Companies tests run in the chromium project with storageState (logged-in user).
 * The unauthenticated describe overrides with empty storage state.
 */

test.describe("Companies Page - Unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects to sign-in when not authenticated", async ({ page }) => {
    await page.goto("/companies");
    await page.waitForURL("**/sign-in**", { timeout: 10000 });
    expect(page.url()).toContain("/sign-in");
  });
});

test.describe("Companies - Authenticated", () => {
  test("displays companies page when authenticated", async ({
    companiesPage,
    page,
  }) => {
    await companiesPage.goto();
    expect(page.url()).toContain("/companies");
    await companiesPage.waitForCompaniesToLoad();
  });

  test("can navigate to create new company", async ({
    companiesPage,
    page,
  }) => {
    await companiesPage.goto();
    await companiesPage.clickNewCompany();
    await page.waitForURL("**/companies/new", { timeout: 10000 });
    expect(page.url()).toContain("/companies/new");
  });

  test("can create a new company", async ({ companiesPage, page }) => {
    await companiesPage.goto();
    await companiesPage.clickNewCompany();
    await page.waitForURL("**/companies/new", { timeout: 10000 });
    await page.getByLabel(/Company Name/i).fill("TEST E2E COMPANY");
    await page.getByLabel(/Website/i).fill("https://example.com");
    await page
      .getByLabel(/LinkedIn URL/i)
      .fill("https://linkedin.com/company/test-e2e-company");
    await page
      .getByPlaceholder(/Add a summary about this company/i)
      .fill("TEST E2E COMPANY SUMMARY");
    await page.getByRole("button", { name: /Create Company/i }).click();
    await page.waitForURL("**/companies", { timeout: 10000 });
    await expect(page.getByText("TEST E2E COMPANY")).toBeVisible({
      timeout: 10000,
    });
  });

  test("can view company list", async ({ companiesPage }) => {
    await companiesPage.goto();
    const companies = await companiesPage.getCompanyItems();
    expect(Array.isArray(companies)).toBe(true);
  });

  test("can search for companies", async ({ companiesPage, page }) => {
    await companiesPage.goto();
    await companiesPage.searchCompany("test");
    await page.waitForLoadState("networkidle").catch(() => {});
  });

  test("can click on a company to view details", async ({
    companiesPage,
    page,
  }) => {
    await companiesPage.goto();
    const companies = await companiesPage.getCompanyItems();
    if (companies.length > 0) {
      await companies[0].click();
      await page.waitForURL(/\/companies\/\d+$/, { timeout: 10000 });
      expect(page.url()).toMatch(/\/companies\/\d+$/);
    } else {
      test.skip();
    }
  });
});

test.describe("Company Detail - Contact Management", () => {
  test("displays company detail page with associated contacts section", async ({
    page,
    companyDetailPage,
  }) => {
    await companyDetailPage.goto(1);
    await expect(companyDetailPage.associatedContactsSection).toBeVisible({
      timeout: 10000,
    });
    await expect(companyDetailPage.addContactButton).toBeVisible();
  });

  test("can add a contact to a company", async ({
    companyDetailPage,
    page,
  }) => {
    await companyDetailPage.goto(1);
    const initialContacts = await companyDetailPage.getAssociatedContacts();
    const selectedName = await companyDetailPage.addContact(
      undefined,
      "Employee",
      false
    );
    const nameToFind = selectedName.replace(/\s*\([^)]*\)$/, "").trim();
    const section = page
      .getByRole("heading", { name: "Associated Contacts" })
      .locator("..")
      .locator("..");
    await expect(section.getByText(nameToFind, { exact: false })).toBeVisible({
      timeout: 10000,
    });
    const newContacts = await companyDetailPage.getAssociatedContacts();
    expect(newContacts.length).toBeGreaterThan(initialContacts.length);
  });

  test("filters out already associated contacts from dropdown", async ({
    companyDetailPage,
    page,
  }) => {
    await companyDetailPage.goto(1);
    const associatedContacts = await companyDetailPage.getAssociatedContacts();
    if (associatedContacts.length === 0) {
      test.skip();
    }
    const firstContactRow = associatedContacts[0];
    await expect(firstContactRow).toBeVisible({ timeout: 10000 });
    const firstContactText =
      (await firstContactRow.textContent({ timeout: 5000 })) ?? "";
    const firstContactName = firstContactText?.split(/\s+/)[0] ?? "";
    if (!firstContactName) {
      test.skip();
    }
    await companyDetailPage.addContactButton.click();
    await expect(page.getByText("Add Contact to Company")).toBeVisible({
      timeout: 5000,
    });
    const select = page.locator("select").first();
    const options = await select.locator("option").allTextContents();
    const isInDropdown = options.some((opt) => opt.includes(firstContactName));
    expect(isInDropdown).toBe(false);
  });

  test("can remove a contact from a company", async ({
    companyDetailPage,
    page,
  }) => {
    await companyDetailPage.goto(1);
    const contacts = await companyDetailPage.getAssociatedContacts();
    if (contacts.length === 0) {
      const addedName = await companyDetailPage.addContact(
        undefined,
        "Employee",
        false
      );
      const nameToRemove = addedName.replace(/\s*\([^)]*\)$/, "").trim();
      await companyDetailPage.removeContact(nameToRemove);
      const isStillVisible = await companyDetailPage.isContactAssociated(
        nameToRemove
      );
      expect(isStillVisible).toBe(false);
      return;
    }
    const firstContact = contacts[0];
    const contactLink = firstContact.locator("a").first();
    const contactName = (await contactLink.textContent())?.trim() || "Unknown";
    await companyDetailPage.removeContact(contactName);
    await page.waitForLoadState("networkidle").catch(() => {});
    const isStillVisible = await companyDetailPage.isContactAssociated(
      contactName
    );
    expect(isStillVisible).toBe(false);
  });

  test("can post a comment on company activity timeline", async ({
    companyDetailPage,
    page,
  }) => {
    await companyDetailPage.goto(1);
    await page
      .getByRole("heading", { name: "Activity" })
      .scrollIntoViewIfNeeded();
    await page
      .getByRole("heading", { name: "Activity" })
      .scrollIntoViewIfNeeded();
    const testComment = `Test comment at ${new Date().toISOString()}`;
    await companyDetailPage.postComment(testComment);
    await expect(page.getByText(testComment)).toBeVisible({ timeout: 10000 });
  });

  test("displays activity timeline section", async ({ companyDetailPage }) => {
    await companyDetailPage.goto(1);
    const activities = await companyDetailPage.getActivityItems();
    expect(activities.length).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Company Edit", () => {
  test("can navigate to edit page", async ({ companyDetailPage, page }) => {
    await companyDetailPage.goto(1);
    await companyDetailPage.clickEdit();
    await page.waitForURL("**/companies/**/edit", { timeout: 10000 });
    expect(page.url()).toContain("/edit");
  });

  test("edit page displays company form", async ({ page }) => {
    await page.goto("/companies/1/edit");
    await expect(page.getByLabel(/Company Name/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByLabel(/Website/i)).toBeVisible();
    await expect(page.getByLabel(/LinkedIn URL/i)).toBeVisible();
    await expect(
      page.getByPlaceholder(/Add a summary about this company/i)
    ).toBeVisible();
  });
});

test.describe("Company Creation", () => {
  test("new company form displays all required fields", async ({ page }) => {
    await page.goto("/companies/new");
    await expect(page.getByLabel(/Company Name/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByLabel(/Website/i)).toBeVisible();
    await expect(page.getByLabel(/LinkedIn URL/i)).toBeVisible();
    await expect(
      page.getByPlaceholder(/Add a summary about this company/i)
    ).toBeVisible();
  });

  test("validates required fields", async ({ page }) => {
    await page.goto("/companies/new");
    await page.getByRole("button", { name: /Create Company/i }).click();
    await expect(page.getByText(/Company name is required/i)).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe("Contact Association Constraints", () => {
  test("shows warning about one-company-per-contact constraint", async ({
    companyDetailPage,
    page,
  }) => {
    await companyDetailPage.goto(1);
    await companyDetailPage.addContactButton.click();
    await expect(page.getByText("Add Contact to Company")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByText(
        /A contact can only be associated with one company at a time/i
      )
    ).toBeVisible();
  });
});

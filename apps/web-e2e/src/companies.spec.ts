import dayjs from "dayjs";
import { test, expect } from "./fixtures";
import { createFreshCompany } from "./fixtures/helpers";

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

  test("creates a new company record in table", async ({ companiesPage, page }) => {
    await companiesPage.goto();

    const initialRowCount = await companiesPage.getRowCount();
    const newRowIndex = await companiesPage.createNewCompany();
    await expect(page.getByText("New company added")).toBeVisible();
    const newRowCount = await companiesPage.getRowCount();
    expect(newRowCount).toBe(initialRowCount + 1);

    const companyNameIndex = await companiesPage.getColumnIndex("Company");
    const newRow = page.getByRole("row").nth(newRowIndex);
    await expect(newRow.locator("td").nth(companyNameIndex)).toHaveText("New Company");
  });

  test("can view company list", async ({ companiesPage }) => {
    await companiesPage.goto();
    const companies = await companiesPage.getCompanyItems();
    expect(Array.isArray(companies)).toBe(true);
  });

  test("can search for companies", async ({ companiesPage, page }) => {
    await companiesPage.goto();
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/tables/companies") && resp.ok()
    );
    await companiesPage.searchCompany("test");
    await responsePromise;
  });

  test("can click on a company to view details", async ({
    companiesPage,
    page,
  }) => {
    await companiesPage.goto();
    const companies = await companiesPage.getCompanyItems();
    if (companies.length > 0) {
      // Find the specific company link within the row to trigger navigation
      const companyLink = companies[0].locator('a[href^="/companies/"]');
      await companyLink.click();

      await page.waitForURL(/\/companies\/\d+$/, { timeout: 10000 });
      expect(page.url()).toMatch(/\/companies\/\d+$/);
    } else {
      test.skip();
    }
  });

  test("Renders add row button at the bottom of the table", async ({
    companiesPage,
    page,
  }) => {
    await companiesPage.goto();
    const companies = await companiesPage.getCompanyItems();

    if (companies.length > 0) {
      const addRowButton = page.getByRole("button", { name: /Add row/i });
      await expect(addRowButton).toBeVisible();
    }
  });

  test("Opens add column dialog when header plus icon is clicked", async ({
    companiesPage,
    page,
  }) => {
    await companiesPage.goto();
    const companies = await companiesPage.getCompanyItems();

    if (companies.length > 0) {
      const addColumnButton = page.getByRole("button", { name: /Add column/i });
      await addColumnButton.click();
      await expect(page.getByText(/Add new field/i)).toBeVisible();
    }
  });
});

test.describe.serial("Company Detail - Contact Management", () => {
  let companyId: number;

  test.beforeAll(async ({ browser }) => {
    companyId = await createFreshCompany(browser);
  });

  test("displays company detail page with associated contacts section", async ({
    companyDetailPage,
  }) => {
    await companyDetailPage.goto(companyId);
    await expect(companyDetailPage.associatedContactsSection).toBeVisible({
      timeout: 10000,
    });
    await expect(companyDetailPage.addContactButton).toBeVisible();
  });

  test("can add a contact to a company", async ({
    companyDetailPage,
    page,
  }) => {
    await companyDetailPage.goto(companyId);
    const selectedName = await companyDetailPage.addContact(
      undefined,
      "Employee",
      false
    );
    const nameToFind = selectedName.replace(/\s*\([^)]*\)$/, "").trim();
    await expect(
      page.locator('a[href^="/contacts/"]', { hasText: nameToFind })
    ).toBeVisible({ timeout: 10000 });
  });

  test("filters out already associated contacts from dropdown", async ({
    companyDetailPage,
    page,
  }) => {
    await companyDetailPage.goto(companyId);
    const associatedContacts = await companyDetailPage.getAssociatedContacts();
    if (associatedContacts.length === 0) {
      test.skip();
    }
    const firstContactRow = associatedContacts[0];
    await expect(firstContactRow).toBeVisible({ timeout: 10000 });
    const firstContactName =
      (await firstContactRow
        .locator('a[href^="/contacts/"]')
        .first()
        .textContent())?.trim() ?? "";
    if (!firstContactName) {
      test.skip();
    }
    await companyDetailPage.addContactButton.click();
    await expect(page.getByText("Add Contact to Company")).toBeVisible({
      timeout: 5000,
    });
    const dialog = page.getByRole("dialog");
    const select = dialog.locator("select").first();

    const selectableOptions = select.locator('option[value]:not([value=""])');
    const matchingOptions = selectableOptions.filter({ hasText: firstContactName });

    // When all contacts are already associated, there will be no selectable options.
    if ((await selectableOptions.count()) === 0) {
      await expect(
        dialog.getByText(/All contacts are already associated with this company/i)
      ).toBeVisible();
      await expect(dialog.getByRole("button", { name: /Add Contact/i })).toBeDisabled();
    } else {
      await expect(matchingOptions).toHaveCount(0);
    }
  });

  test("can remove a contact from a company", async ({
    companyDetailPage,
  }) => {
    await companyDetailPage.goto(companyId);
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
    const isStillVisible = await companyDetailPage.isContactAssociated(
      contactName
    );
    expect(isStillVisible).toBe(false);
  });

  test("can post a comment on company activity timeline", async ({
    companyDetailPage,
    page,
  }) => {
    await companyDetailPage.goto(companyId);
    await companyDetailPage.openActivityHistory();
    const testComment = `Test comment at ${new Date().toISOString()}`;
    await companyDetailPage.postComment(testComment);
    await expect(page.getByText(testComment)).toBeVisible({ timeout: 10000 });
  });

  test("displays activity timeline section", async ({ companyDetailPage }) => {
    await companyDetailPage.goto(companyId);
    const activities = await companyDetailPage.getActivityItems();
    expect(activities.length).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Company Detail - Inline Editing with Activity Verification", () => {
  let companyId: number;

  test.beforeAll(async ({ browser }) => {
    companyId = await createFreshCompany(browser);
  });

  test("can edit company name inline", async ({ companyDetailPage, page }) => {
    const newName = `Acme Corp ${Date.now()}`;
    await companyDetailPage.goto(companyId);
    await companyDetailPage.openActivityHistory();
    await companyDetailPage.updateCompanyName(newName, companyId);

    // Verify immediate UI update
    await expect(companyDetailPage.companyName).toHaveText(newName);
    await companyDetailPage.expectActivityEntry(/updated companyName from/i);

    // Refresh and verify persistence
    await page.reload();
    await expect(companyDetailPage.companyName).toHaveText(newName);
  });

  test("can edit company summary", async ({ companyDetailPage, page }) => {
    const newSummary = `Enterprise solutions provider — updated at ${Date.now()}`;
    await companyDetailPage.goto(companyId);
    await companyDetailPage.openActivityHistory();
    await companyDetailPage.updateSummary(newSummary, companyId);

    // Verify immediate UI update
    await expect(companyDetailPage.summaryField).toHaveValue(newSummary);
    await companyDetailPage.expectActivityEntry(`set summary to "${newSummary}"`);

    // Refresh and verify persistence
    await page.reload();
    await expect(companyDetailPage.summaryField).toHaveValue(newSummary);
  });

  test("can set/edit company website", async ({
    companyDetailPage,
    page,
  }) => {
    const newWebsite = `https://acme-${Date.now()}.com`;
    await companyDetailPage.goto(companyId);
    await companyDetailPage.openActivityHistory();

    // Test setting value initially
    await companyDetailPage.updateProperty("Website", newWebsite, companyId);
    await expect(companyDetailPage.propertyRow("Website").locator("dd")).toHaveText(newWebsite);
    
    // Verify it renders as a clickable <a> tag with correct href
    const link = companyDetailPage.getPropertyLink("Website");
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", newWebsite);
    await expect(link).toHaveAttribute("target", "_blank");
    await companyDetailPage.expectActivityEntry(`set website to "${newWebsite}"`);

    // Test updating the value
    const updatedWebsite = `https://acme-${Date.now()}-updated.com`;
    await companyDetailPage.updateProperty("Website", updatedWebsite, companyId);
    await expect(companyDetailPage.propertyRow("Website").locator("dd")).toHaveText(updatedWebsite);
    await companyDetailPage.expectActivityEntry(`updated website from "${newWebsite}" to "${updatedWebsite}"`);

    // Refresh and verify persistence + link rendering
    await page.reload();
    const persisted = await companyDetailPage.getPropertyValue("Website");
    expect(persisted).toBe(updatedWebsite);
    await expect(companyDetailPage.getPropertyLink("Website")).toHaveAttribute("href", updatedWebsite);
  });

  test("can set/edit company linkedin", async ({
    companyDetailPage,
    page,
  }) => {
    const newLinkedin = `https://linkedin.com/company/acme-${Date.now()}`;
    await companyDetailPage.goto(companyId);
    await companyDetailPage.openActivityHistory();

     // Test setting value initially
    await companyDetailPage.updateProperty("LinkedIn", newLinkedin, companyId);
    await expect(companyDetailPage.propertyRow("LinkedIn").locator("dd")).toHaveText(newLinkedin);

    // Verify it renders as a clickable <a> tag with correct href
    const link = companyDetailPage.getPropertyLink("LinkedIn");
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", newLinkedin);
    await expect(link).toHaveAttribute("target", "_blank");
    await companyDetailPage.expectActivityEntry(`set linkedinUrl to "${newLinkedin}"`);

    // Test updating the value
    const updatedLinkedin = `https://linkedin.com/company/acme-${Date.now()}-updated`;
    await companyDetailPage.updateProperty("LinkedIn", updatedLinkedin, companyId);
    await expect(companyDetailPage.propertyRow("LinkedIn").locator("dd")).toHaveText(updatedLinkedin);
    await companyDetailPage.expectActivityEntry(`updated linkedinUrl from "${newLinkedin}" to "${updatedLinkedin}"`);

    // Refresh and verify persistence + link rendering
    await page.reload();
    const persisted = await companyDetailPage.getPropertyValue("LinkedIn");
    expect(persisted).toBe(updatedLinkedin);
    await expect(companyDetailPage.getPropertyLink("LinkedIn")).toHaveAttribute("href", updatedLinkedin);
  });

  test("shows validation error for invalid website URL", async ({
    companyDetailPage,
    page,
  }) => {
    await companyDetailPage.goto(companyId);
    const input = await companyDetailPage.openPropertyEditor("Website");
    await input.fill("not-a-url");
    await input.press("Enter");

    await expect(
      page.getByText(/Must be a valid URL/i)
    ).toBeVisible({ timeout: 3000 });
  });

  test("shows validation error for invalid linkedin URL", async ({
    companyDetailPage,
    page,
  }) => {
    await companyDetailPage.goto(companyId);
    const input = await companyDetailPage.openPropertyEditor("LinkedIn");
    await input.fill("not-a-url");
    await input.press("Enter");

    await expect(
      page.getByText(/Must be a valid URL/i)
    ).toBeVisible({ timeout: 3000 });

    await input.fill("https://acme.com");
    await input.press("Enter");

    await expect(
      page.getByText(/Must be a valid LinkedIn URL/i)
    ).toBeVisible({ timeout: 3000 });
  });

  test("pressing Escape cancels EntityProperties editing without saving", async ({
    companyDetailPage,
  }) => {
    await companyDetailPage.goto(companyId);

    const originalValue = await companyDetailPage.getPropertyValue("Website");

    const input = await companyDetailPage.openPropertyEditor("Website");
    await input.fill("https://should-be-reverted.com");
    await input.press("Escape");

    // Input should disappear
    await expect(input).toBeHidden({ timeout: 3000 });

    // Value should be unchanged
    const currentValue = await companyDetailPage.getPropertyValue("Website");
    expect(currentValue).toBe(originalValue);
  });

  test("clearing an EntityProperties field saves null", async ({
    companyDetailPage,
    page,
  }) => {
    const tempValue = `https://linkedin.com/company/acme-${Date.now()}`;
    await companyDetailPage.goto(companyId);
    
    // 1. Ensure the field has a value first so we have something to clear
    await companyDetailPage.updateProperty("LinkedIn", tempValue, companyId);
    await expect(companyDetailPage.propertyRow("LinkedIn").locator("dd")).toHaveText(tempValue);

    // 2. Now clear the field
    await companyDetailPage.updateProperty("LinkedIn", "", companyId);
    
    // 3. Verify it shows the empty placeholder "—"
    await expect(companyDetailPage.propertyRow("LinkedIn").locator("dd")).toHaveText("—");

    // 4. Reload and verify persistence
    await page.reload();
    const persisted = await companyDetailPage.getPropertyValue("LinkedIn");
    expect(persisted).toBe("—");
  });
});

test.describe.serial("Column Creation Flow", () => {
  const identifier = Date.now();
  const columnName = `Source ${identifier}`;
  const columnKey = `source_${identifier}`;

  test("Creates new column from column creation dialog", async ({
    companiesPage,
    page,
  }) => {
    await companiesPage.goto();

    const addColumnButton = page.getByRole("button", { name: /Add column/i });
    await addColumnButton.click();

    await expect(page.getByText(/Add new field/i)).toBeVisible();

    await page.getByPlaceholder("Field name").fill(columnName);
    await page.getByPlaceholder(/Unique column key/i).fill(columnKey);
    await page.locator("select").selectOption("text");

    await page.getByRole("button", { name: "Create field" }).click();

    await expect(page.getByText("Column created successfully")).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: columnName })
    ).toBeVisible();
  });

  test("Shows error toast when creating column with existing default column key (website)", async ({
    companiesPage,
    page,
  }) => {
    await companiesPage.goto();

    const addColumnButton = page.getByRole("button", { name: /Add column/i });
    await addColumnButton.click();

    await page.getByPlaceholder("Field name").fill("Column New");
    await page.getByPlaceholder(/Unique column key/i).fill("website");
    await page.getByRole("button", { name: "Create field" }).click();

    await expect(page.getByText("Column key already exists")).toBeVisible();
  });

  test("Shows error toast when creating column with existing column key", async ({
    companiesPage,
    page,
  }) => {
    await companiesPage.goto();

    const addColumnButton = page.getByRole("button", { name: /Add column/i });
    await addColumnButton.click();

    await page.getByPlaceholder("Field name").fill("Column New");
    await page.getByPlaceholder(/Unique column key/i).fill(columnKey);
    await page.getByRole("button", { name: "Create field" }).click();

    await expect(page.getByText("Column key already exists")).toBeVisible();
  });

  test("Shows field level validation when submitting empty form", async ({
    companiesPage,
    page,
  }) => {
    await companiesPage.goto();

    const addColumnButton = page.getByRole("button", { name: /Add column/i });
    await addColumnButton.click();

    await page.getByRole("button", { name: "Create field" }).click();

    await expect(page.getByText("Field name is required")).toBeVisible();
    await expect(page.getByText("Column key is required")).toBeVisible();

    const invalidKey = 'column Key';
    await page.getByPlaceholder("Field name").fill("Column New");
    await page.getByPlaceholder(/Unique column key/i).fill(invalidKey);
    await page.getByRole("button", { name: "Create field" }).click();

    await expect(page.getByText("Column key must contain only lowercase letters, numbers, and underscores")).toBeVisible();
  });
});

test.describe("Row Creation Flow", () => {
  test("Creates new company row using add row button", async ({ companiesPage, page }) => {
    await companiesPage.goto();
    await companiesPage.getCompanyItems();

    const initialRowCount = await page.getByRole("row").count();

    const addRowButton = page.getByRole("button", { name: /Add row/i });
    await addRowButton.click();

    // validate success toast message
    await expect(page.getByText(/New company added/i)).toBeVisible();

    // validate if new row is created
    await expect(page.getByRole("row")).toHaveCount(initialRowCount + 1);
    const updatedRowCount = initialRowCount + 1;

    // Get the headers to find column indices
    const headers = page.getByRole("columnheader");
    const headerTexts = await headers.allInnerTexts();
    
    // Find expected column indices
    const sNoIndex = headerTexts.findIndex(h => h.toLowerCase().includes("s.no"));
    const companyNameIndex = headerTexts.findIndex(h => h.toLowerCase().includes("company"));
    const ownerIndex = headerTexts.findIndex(h => h.toLowerCase().includes("owner"));
    const createdIndex = headerTexts.findIndex(h => h.toLowerCase().includes("created"));

    // nth() is 0-indexed, and initialRowCount counts the header + existing data rows.
    const newCompanyRow = page.getByRole("row").nth(initialRowCount);

    // Validate S.No field to be equal to the {updatedRowCount - 1} (row count also includes the header)
    await expect(newCompanyRow.locator("td").nth(sNoIndex)).toHaveText((updatedRowCount-1).toString());

    // Validate Company name field
    await expect(newCompanyRow.locator("td").nth(companyNameIndex)).toHaveText("New Company");

    // Validate Owner field (current user name)
    await expect(newCompanyRow.locator("td").nth(ownerIndex)).toContainText("E2E Test User");

    // Validate Created Date field (DD MMM YYYY)
    const formattedDate = dayjs().format('DD MMM YYYY');
    await expect(newCompanyRow.locator("td").nth(createdIndex)).toContainText(formattedDate);
  });
});

test.describe("Cell Editing Flow", () => {
  test("Edits company name cell value (entity type)", async ({ companiesPage, page }) => {
    await companiesPage.goto();
    await companiesPage.getCompanyItems();

    const firstRow = page.getByRole("row").nth(1);
    const headers = page.getByRole("columnheader");
    const headerTexts = await headers.allInnerTexts();
    const companyNameIndex = headerTexts.findIndex(h => h.toLowerCase().includes("company"));

    const companyNameCell = firstRow.locator("td").nth(companyNameIndex);
    const newValue = "Updated Company Name";

    await companyNameCell.evaluate(node => (node as any).click());
    const input = companyNameCell.locator("input");
    await expect(input).toBeVisible();
    await input.fill(newValue);
    await input.press("Enter");

    await expect(page.getByText("Cell updated successfully")).toBeVisible();
    await expect(companyNameCell).toHaveText(newValue);

    await page.reload();
    await companiesPage.getCompanyItems();
    await expect(page.getByText(newValue, { exact: true })).toBeVisible();
  });

  test("Edits company website cell value (text type)", async ({ companiesPage, page }) => {
    await companiesPage.goto();
    await companiesPage.getCompanyItems();

    const firstRow = page.getByRole("row").nth(1);
    const headers = page.getByRole("columnheader");
    const headerTexts = await headers.allInnerTexts();
    const websiteIndex = headerTexts.findIndex(h => h.toLowerCase().includes("website"));

    const websiteCell = firstRow.locator("td").nth(websiteIndex);
    const newValue = "https://updated-example.com";

    await websiteCell.evaluate(node => (node as any).click());
    const input = websiteCell.locator("input");
    await expect(input).toBeVisible();
    await input.fill(newValue);
    await input.press("Enter");

    await expect(page.getByText("Cell updated successfully")).toBeVisible();
    await expect(websiteCell).toHaveText(newValue);

    await page.reload();
    await companiesPage.getCompanyItems();
    await expect(page.getByText(newValue)).toBeVisible();
  });

  test("Quits editing mode when Escape key is pressed", async ({ companiesPage, page }) => {
    await companiesPage.goto();
    await companiesPage.getCompanyItems();

    const firstRow = page.getByRole("row").nth(1);
    const headers = page.getByRole("columnheader");
    const headerTexts = await headers.allInnerTexts();
    const linkedinIndex = headerTexts.findIndex(h => h.toLowerCase().includes("linkedin"));
    expect(linkedinIndex).toBeGreaterThan(-1);

    const linkedinCell = firstRow.locator("td").nth(linkedinIndex);
    const linkedinContent = await linkedinCell.textContent();
    expect(typeof linkedinContent).toBe("string");
    const originalValue = (linkedinContent as string).trim();
    const newValue = "https://linkedin.com/company/reverted";

    await linkedinCell.evaluate(node => (node as any).click());
    const input = linkedinCell.locator("input");
    await expect(input).toBeVisible();
    await input.fill(newValue);
    await input.press("Escape");

    // Input should be hidden
    await expect(input).toBeHidden();
    // Value should be the original value
    await expect(linkedinCell).toHaveText(originalValue);
  });
});

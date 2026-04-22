import dayjs from "dayjs";
import { test, expect } from "./fixtures";
import { createFreshContact } from "./fixtures/helpers";

/**
 * Contacts tests run with project storage state (logged-in user).
 */

test.describe("Contacts Page - Unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects to sign-in when not authenticated", async ({ page }) => {
    await page.goto("/contacts");
    await page.waitForURL("**/sign-in**", { timeout: 10000 });
    await expect(page.locator("h1")).toContainText("Sign in to Zuko");
  });
});

test.describe("Contacts - Authenticated", () => {
  test("can create a new contact record in table", async ({ contactsPage, page }) => {
    await contactsPage.goto();

    const initialRowCount = await contactsPage.getRowCount();
    const newRowIndex = await contactsPage.createNewContact();
    await expect(page.getByText("New contact added")).toBeVisible();
    const newRowCount = await contactsPage.getRowCount();
    expect(newRowCount).toBe(initialRowCount + 1);

    const nameIndex = await contactsPage.getColumnIndex("Name");
    const newRow = page.getByRole("row").nth(newRowIndex);
    await expect(newRow.locator("td").nth(nameIndex)).toHaveText("New Contact");
  });

  test("can view contact list", async ({ contactsPage }) => {
    await contactsPage.goto();
    const contacts = await contactsPage.getContactItems();
    expect(Array.isArray(contacts)).toBe(true);
  });

  test("can search for contacts", async ({ contactsPage, page }) => {
    await contactsPage.goto();
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/tables/contacts") && resp.ok()
    );
    await contactsPage.searchContact("test");
    await responsePromise;
  });

  test("can click on a contact to view details", async ({
    contactsPage,
    page,
  }) => {
    await contactsPage.goto();
    await contactsPage.waitForContactsToLoad();
    const contactName = `New Contact ${Date.now()}`;
    await contactsPage.createContactRow(contactName);
    
    const testContactRow = page
      .getByRole("row")
      .filter({ hasText: contactName })
      .first();
    
    // Find the specific contact link within the row to trigger navigation
    const contactLink = testContactRow.locator('a[href^="/contacts/"]');
    await contactLink.click();

    await page.waitForURL("**/contacts/**", { timeout: 10000 });

    await expect(
      page.getByRole("heading", { name: contactName })
    ).toBeVisible({ timeout: 10000 });
  });

  test("Renders add row button at the bottom of the table", async ({
    contactsPage,
    page,
  }) => {
    await contactsPage.goto();
    const contacts = await contactsPage.getContactItems();

    if (contacts.length > 0) {
      const addRowButton = page.getByRole("button", { name: /Add row/i });
      await expect(addRowButton).toBeVisible();
    }
  });

  test("Opens add column dialog when header plus icon is clicked", async ({
    contactsPage,
    page,
  }) => {
    await contactsPage.goto();
    const contacts = await contactsPage.getContactItems();

    if (contacts.length > 0) {
      const addColumnButton = page.getByRole("button", { name: /Add column/i });
      await addColumnButton.click();
      await expect(page.getByText(/Add new field/i)).toBeVisible();
    }
  });

});

test.describe.serial("Column Creation Flow", () => {
  const identifier = Date.now();
  const columnName = `Source ${identifier}`;
  const columnKey = `source_${identifier}`;

  test("Creates new column from column creation dialog", async ({
    contactsPage,
    page,
  }) => {
    await contactsPage.goto();

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

  test("Shows error toast when creating column with existing default column key (name)", async ({
    contactsPage,
    page,
  }) => {
    await contactsPage.goto();

    const addColumnButton = page.getByRole("button", { name: /Add column/i });
    await addColumnButton.click();

    await page.getByPlaceholder("Field name").fill("Column New");
    await page.getByPlaceholder(/Unique column key/i).fill("name");
    await page.getByRole("button", { name: "Create field" }).click();

    await expect(page.getByText("Column key already exists")).toBeVisible();
  });

  test("Shows error toast when creating column with existing column key", async ({
    contactsPage,
    page,
  }) => {
    await contactsPage.goto();

    const addColumnButton = page.getByRole("button", { name: /Add column/i });
    await addColumnButton.click();

    await page.getByPlaceholder("Field name").fill("Column New");
    await page.getByPlaceholder(/Unique column key/i).fill(columnKey);
    await page.getByRole("button", { name: "Create field" }).click();

    await expect(page.getByText("Column key already exists")).toBeVisible();
  });

  test("Shows field level validation when submitting empty form", async ({
    contactsPage,
    page,
  }) => {
    await contactsPage.goto();

    const addColumnButton = page.getByRole("button", { name: /Add column/i });
    await addColumnButton.click();

    await page.getByRole("button", { name: "Create field" }).click();

    await expect(page.getByText("Field name is required")).toBeVisible();
    await expect(page.getByText("Column key is required")).toBeVisible();

    const invalidKey = "column key";
    await page.getByPlaceholder("Field name").fill(columnName);
    await page.getByPlaceholder(/Unique column key/i).fill(invalidKey);
    await page.getByRole("button", { name: "Create field" }).click();
    
    await expect(page.getByText("Column key must contain only lowercase letters, numbers, and underscores")).toBeVisible();
  });
});

test.describe("Row Creation Flow", () => {
  test("Creates new contact row using add row button", async ({ contactsPage, page }) => {
    await contactsPage.goto();
    await contactsPage.getContactItems();

    const initialRowCount = await page.getByRole("row").count();

    const addRowButton = page.getByRole("button", { name: /Add row/i });
    await addRowButton.click();

    // validate success toast message
    await expect(page.getByText(/New contact added/i)).toBeVisible();

    // validate if new row is created
    await expect(page.getByRole("row")).toHaveCount(initialRowCount + 1);
    const updatedRowCount = initialRowCount + 1;

    // Get the headers to find column indices
    const headers = page.getByRole("columnheader");
    const headerTexts = await headers.allInnerTexts();
    
    // Find expected column indices
    const sNoIndex = headerTexts.findIndex(h => h.toLowerCase().includes("s.no"));
    const nameIndex = headerTexts.findIndex(h => h.toLowerCase().includes("name"));
    const ownerIndex = headerTexts.findIndex(h => h.toLowerCase().includes("owner"));
    const createdIndex = headerTexts.findIndex(h => h.toLowerCase().includes("created"));

    // nth() is 0-indexed, and initialRowCount counts the header + existing data rows.
    const newContactRow = page.getByRole("row").nth(initialRowCount);

    // Validate S.No field to be equal to the {updatedRowCount - 1} (row count also includes the header)
    await expect(newContactRow.locator("td").nth(sNoIndex)).toHaveText((updatedRowCount-1).toString());

    // Validate Name field
    await expect(newContactRow.locator("td").nth(nameIndex)).toHaveText("New Contact");

    // Validate Owner field (current user name)
    await expect(newContactRow.locator("td").nth(ownerIndex)).toContainText("E2E Test User");

    // Validate Created Date field (DD MMM YYYY)
    const formattedDate = dayjs().format('DD MMM YYYY');
    await expect(newContactRow.locator("td").nth(createdIndex)).toContainText(formattedDate);
  });
});

test.describe("Cell Editing Flow", () => {
  test("Edits contact name cell value (entity type)", async ({ contactsPage, page }) => {
    await contactsPage.goto();
    await contactsPage.getContactItems();

    const firstRow = page.getByRole("row").nth(1);
    const headers = page.getByRole("columnheader");
    const headerTexts = await headers.allInnerTexts();
    const nameIndex = headerTexts.findIndex(h => h.toLowerCase().includes("name"));

    const nameCell = firstRow.locator("td").nth(nameIndex);
    const newValue = "Updated Contact Name";

    await nameCell.evaluate(node => (node as any).click());
    const input = nameCell.locator("input");
    await expect(input).toBeVisible();
    await input.fill(newValue);
    await input.press("Enter");

    await expect(page.getByText("Cell updated successfully")).toBeVisible();
    await expect(nameCell).toHaveText(newValue);

    await page.reload();
    await contactsPage.getContactItems();
    await expect(page.getByText(newValue)).toBeVisible();
  });

  test("Edits contact email cell value (text type)", async ({ contactsPage, page }) => {
    await contactsPage.goto();
    await contactsPage.getContactItems();

    const firstRow = page.getByRole("row").nth(1);
    const headers = page.getByRole("columnheader");
    const headerTexts = await headers.allInnerTexts();
    const emailIndex = headerTexts.findIndex(h => h.toLowerCase().includes("email"));

    const emailCell = firstRow.locator("td").nth(emailIndex);
    const newValue = `updated-${Date.now()}@example.com`;

    await emailCell.evaluate(node => (node as any).click());
    const input = emailCell.locator("input");
    await expect(input).toBeVisible();
    await input.fill(newValue);
    await input.press("Enter");

    await expect(page.getByText("Cell updated successfully")).toBeVisible();
    await expect(emailCell).toHaveText(newValue);

    await page.reload();
    await contactsPage.getContactItems();
    await expect(page.getByText(newValue)).toBeVisible();
  });
});

test.describe("Contact Detail - Inline Editing with Activity Verification", () => {
  let contactId: number;

  test.beforeAll(async ({ browser }) => {
    contactId = await createFreshContact(browser);
  });

  test("can edit contact name inline", async ({ contactDetailPage, page }) => {
    const newName = `Updated Contact Name ${Date.now()}`;
    await contactDetailPage.goto(contactId);
    await contactDetailPage.openActivityHistory();
    await contactDetailPage.updateContactName(newName, contactId);

    // Verify immediate UI update
    await expect(contactDetailPage.contactName).toHaveText(newName);
    await contactDetailPage.expectActivityEntry(/updated name from/i);

    // Refresh and verify persistence
    await page.reload();
    await expect(contactDetailPage.contactName).toHaveText(newName);
  });

  test("can edit contact notes", async ({ contactDetailPage, page }) => {
    const newNotes = `Updated Contact Notes — updated at ${Date.now()}`;
    await contactDetailPage.goto(contactId);
    await contactDetailPage.openActivityHistory();
    await contactDetailPage.updateNotes(newNotes, contactId);

    // Verify immediate UI update
    await expect(contactDetailPage.notesField).toHaveText(newNotes);
    await contactDetailPage.expectActivityEntry(/set notes/i);

    // Refresh and verify persistence
    await page.reload();
    await expect(contactDetailPage.notesField).toHaveText(newNotes);
  });

  test("can set/edit contact email", async ({ contactDetailPage, page }) => {
    const newEmail = `test-${Date.now()}@example.com`;
    await contactDetailPage.goto(contactId);
    await contactDetailPage.openActivityHistory();

    // Test setting value initially
    await contactDetailPage.updateProperty("Email", newEmail, contactId);
    await expect(contactDetailPage.propertyRow("Email").locator("dd")).toHaveText(newEmail);
    
    // Verify it renders as a clickable <a> tag with correct href
    const link = contactDetailPage.getPropertyLink("Email");
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", `mailto:${newEmail}`);
    await contactDetailPage.expectActivityEntry(`set email to "${newEmail}"`);

    // Test updating the value
    const updatedEmail = `updated-${Date.now()}@example.com`;
    await contactDetailPage.updateProperty("Email", updatedEmail, contactId);
    await expect(contactDetailPage.propertyRow("Email").locator("dd")).toHaveText(updatedEmail);
    await contactDetailPage.expectActivityEntry(`updated email from "${newEmail}" to "${updatedEmail}"`);

    // Refresh and verify persistence + link rendering
    await page.reload();
    const persisted = await contactDetailPage.getPropertyValue("Email");
    expect(persisted).toBe(updatedEmail);
    await expect(contactDetailPage.getPropertyLink("Email")).toHaveAttribute("href", `mailto:${updatedEmail}`);
  });

  // ── 4. Phone ──────────────────────────────────────────────────────────────
  test("can set/edit contact phone", async ({ contactDetailPage, page }) => {
    const newPhone = `+1424555${Math.floor(Math.random() * 9000 + 1000)}`;
    await contactDetailPage.goto(contactId);
    await contactDetailPage.openActivityHistory();

    // Test setting value initially
    await contactDetailPage.updateProperty("Phone", newPhone, contactId);
    await expect(contactDetailPage.propertyRow("Phone").locator("dd")).toHaveText(newPhone);

    // Test updating the value
    const updatedPhone = `+1424555${Math.floor(Math.random() * 9000 + 1000)}`;
    await contactDetailPage.updateProperty("Phone", updatedPhone, contactId);
    await expect(contactDetailPage.propertyRow("Phone").locator("dd")).toHaveText(updatedPhone);
    await contactDetailPage.expectActivityEntry(`updated phone from "${newPhone}" to "${updatedPhone}"`);

    // Refresh and verify persistence + link rendering
    await page.reload();
    const persisted = await contactDetailPage.getPropertyValue("Phone");
    expect(persisted).toBe(updatedPhone);
  });

  // ── 5. LinkedIn ID ──────────────────────────────────────────────────────────

  test("can set/edit contact linkedinId", async ({ contactDetailPage, page }) => {
    const newLinkedin = `jhon-${Date.now()}`;
    await contactDetailPage.goto(contactId);
    await contactDetailPage.openActivityHistory();

     // Test setting value initially
    await contactDetailPage.updateProperty("LinkedIn", newLinkedin, contactId);
    await expect(contactDetailPage.propertyRow("LinkedIn").locator("dd")).toHaveText(newLinkedin);

    // Test updating the value
    const updatedLinkedin = `jhon-${Date.now()}-updated`;
    await contactDetailPage.updateProperty("LinkedIn", updatedLinkedin, contactId);
    await expect(contactDetailPage.propertyRow("LinkedIn").locator("dd")).toHaveText(updatedLinkedin);
    await contactDetailPage.expectActivityEntry(`updated linkedinId from "${newLinkedin}" to "${updatedLinkedin}"`);

    // Refresh and verify persistence + link rendering
    await page.reload();
    const persisted = await contactDetailPage.getPropertyValue("LinkedIn");
    expect(persisted).toBe(updatedLinkedin);
  });

  // ── 6. Validation Checks ─────────────────────────────────────────────────

  test("shows validation error for invalid email", async ({ contactDetailPage, page }) => {
    await contactDetailPage.goto(contactId);
    const input = await contactDetailPage.openPropertyEditor("Email");
    await input.fill("not-an-email");
    await input.press("Enter");

    await expect(page.getByText(/Must be a valid email address/i)).toBeVisible({ timeout: 3000 });
  });

  test("shows validation error for invalid phone", async ({ contactDetailPage, page }) => {
    await contactDetailPage.goto(contactId);
    const input = await contactDetailPage.openPropertyEditor("Phone");
    await input.fill("not-a-phone");
    await input.press("Enter");

    await expect(page.getByText(/Must be in E.164 format/i)).toBeVisible({ timeout: 3000 });
  });

  test("clearing an EntityProperties field saves null", async ({ contactDetailPage, page }) => {
    const tempValue = `+1424555${Math.floor(Math.random() * 9000 + 1000)}`;
    await contactDetailPage.goto(contactId);
    
    await contactDetailPage.updateProperty("Phone", tempValue, contactId);
    await expect(contactDetailPage.propertyRow("Phone").locator("dd")).toHaveText(tempValue);

    await contactDetailPage.updateProperty("Phone", "", contactId);
    await expect(contactDetailPage.propertyRow("Phone").locator("dd")).toHaveText("—");

    await page.reload();
    const persisted = await contactDetailPage.getPropertyValue("Phone");
    expect(persisted).toBe("—");
  });
});

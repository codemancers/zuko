import dayjs from "dayjs";
import { test, expect } from "./fixtures";

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
  test("can create a new contact", async ({ contactsPage, page }) => {
    await contactsPage.goto();
    await contactsPage.clickNewContact();
    await page.waitForURL("**/contacts/new", { timeout: 10000 });
    await page.getByLabel(/Name/i).fill("TEST E2E CONTACT");
    await page.getByLabel(/Email/i).fill("test-e2e-contact@example.com");
    await page.getByLabel(/Phone/i).fill("+14155552671");
    await page
      .getByLabel(/LinkedIn ID/i)
      .fill("https://linkedin.com/in/test-e2e-contact");
    await page
      .getByPlaceholder(/Add notes about this contact.../i)
      .fill("TEST E2E NOTES");
    await page.getByRole("button", { name: /Create Contact/i }).click();
    await page.waitForURL("**/contacts", { timeout: 10000 });
    await expect(page.getByText("TEST E2E CONTACT")).toBeVisible({
      timeout: 10000,
    });
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

    const testContactRow = page
      .getByRole("row")
      .filter({ hasText: "TEST E2E CONTACT" })
      .first();
    await testContactRow.locator("td:first-child").click();
    await page.waitForURL("**/contacts/**", { timeout: 10000 });

    await expect(
      page.getByRole("heading", { name: "TEST E2E CONTACT" })
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("TEST E2E NOTES")).toBeVisible({
      timeout: 10000,
    });
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
  const columnName = "Source";
  const columnKey = `source`;

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

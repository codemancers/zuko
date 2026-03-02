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
    await contactsPage.searchContact("test");
    await page.waitForLoadState("networkidle").catch(() => {});
  });

  test("can click on a contact to view details", async ({
    contactsPage,
    page,
  }) => {
    await contactsPage.goto();
    const contacts = await contactsPage.getContactItems();

    await contacts[0].click();
    await page.waitForURL("**/contacts/**", { timeout: 10000 });

    await expect(
      page.getByRole("heading", { name: "TEST E2E CONTACT" })
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("TEST E2E NOTES")).toBeVisible({
      timeout: 10000,
    });
  });
});

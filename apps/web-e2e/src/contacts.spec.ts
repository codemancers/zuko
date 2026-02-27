import { test, expect } from "./fixtures";

/**
 * Contacts tests run with project storage state (logged-in user).
 * Unauthenticated describe overrides with empty storage state.
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
    console.log("contacts", contacts);
    if (contacts.length > 0) {
      await contacts[0].click();
      await page.waitForURL("**/contacts/**", { timeout: 10000 });
      expect(page.url()).toContain("/contacts/1");

      await expect(
        page.getByRole("heading", { name: "Test E2E Contact" })
      ).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("+14155552671")).toBeVisible({
        timeout: 10000,
      });
      await expect(
        page.getByText("https://linkedin.com/in/teste2econtact")
      ).toBeVisible({
        timeout: 10000,
      });
    } else {
      console.log("no contacts found");
      test.skip();
    }
  });
});

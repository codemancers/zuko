import { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * Page Object Model for Contacts page
 */
export class ContactsPage extends BasePage {
  // Common locators that might exist on contacts page
  readonly newContactButton: Locator;
  readonly contactsList: Locator;

  constructor(page: Page) {
    super(page);
    // Selectors based on actual ContactsList component
    this.newContactButton = page.getByRole("button", { name: "New Contact" });
    this.contactsList = page.locator("table").or(page.locator("main"));
  }

  /**
   * Navigate to the contacts page
   */
  override async goto() {
    await super.goto("/contacts");
    // Wait for page to be fully loaded and interactive
    await this.page.waitForLoadState('domcontentloaded');
    // Wait for either the table or the main content to be visible
    await this.page.waitForSelector('table, main', { state: 'visible' });
  }

  /**
   * Click the new contact button
   */
  async clickNewContact() {
    await this.newContactButton.click();
  }

  /**
   * Search for a contact by name
   */
  async searchContact(name: string) {
    // Input with type="search" and placeholder starting with "Search contacts"
    const searchInput = this.page.getByPlaceholder(/Search contacts/i);
    await searchInput.fill(name);
  }

  /**
   * Get all contact items
   */
  async getContactItems() {
    // Table rows in tbody (excluding header row)
    return this.page.locator("tbody tr").all();
  }

  /**
   * Click on a contact by name
   */
  async clickContact(name: string) {
    await this.page.getByText(name, { exact: false }).click();
  }

  /**
   * Create a new contact by navigating to the creation form
   */
  async createContact({ name, email }: { name: string; email: string }) {
    await this.page.goto('/contacts/new');
    await this.page.getByLabel(/Name/i).fill(name);
    await this.page.getByLabel(/Email/i).fill(email);
    await this.page.getByRole('button', { name: /Create Contact/i }).click();
    await this.page.waitForURL('**/contacts', { timeout: 10000 });
  }
}

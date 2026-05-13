import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for Contacts page
 */
export class ContactsPage extends BasePage {
  // Common locators that might exist on contacts page
  readonly newContactButton: Locator;
  readonly contactsList: Locator;
  readonly createContactButton: Locator;
  readonly contactNameInput: Locator;

  constructor(page: Page) {
    super(page);
    // Selectors based on actual ContactsList component
    this.newContactButton = page
      .getByRole('button', { name: 'New Contact' })
      .first();
    this.contactsList = page.locator('table').or(page.locator('main'));
    this.createContactButton = page.getByRole('button', {
      name: /^Create Contact$/i,
    });
    this.contactNameInput = page.getByLabel(/^Name \*/i);
  }

  /**
   * Navigate to the contacts page
   */
  override async goto() {
    await super.goto('/contacts');
    // Wait for the table to be visible and data to finish loading
    await this.page.waitForSelector('table, main', { state: 'visible' });
    await this.page.waitForLoadState('networkidle');
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
    const table = this.page.locator('table');
    if ((await table.count()) === 0) {
      return [];
    }
    return this.page.locator('tbody tr').all();
  }

  /**
   * Click on a contact name
   */
  async clickContact(row: Locator) {
    await row.locator('a[href^="/contacts/"]').click();
  }

  /**
   * Wait for contacts to load
   */
  async waitForContactsToLoad() {
    await Promise.race([
      this.page.waitForSelector('table', { timeout: 10000 }),
      this.page.getByText(/No contacts yet/i).waitFor({ timeout: 10000 }),
    ]).catch(() => null);
  }

  /**
   * Create a new contact and return the table row index
   */
  async createNewContact(contactName = `New Contact ${Date.now()}`) {
    await this.page.waitForLoadState('networkidle');
    await this.createNewRecord(contactName);
    return contactName;
  }

  /**
   * Create a new contact row with given name
   */
  async createContactRow(contactName: string) {
    await this.createNewRecord(contactName);
    await expect(this.page.getByText(contactName)).toBeVisible();
  }

  override async createNewRecord(contactName = `New Contact ${Date.now()}`) {
    await this.newContactButton.click();
    await expect(
      this.page.getByRole('heading', { name: /New Contact/i }),
    ).toBeVisible();
    await this.contactNameInput.fill(contactName);
    await this.page.getByLabel(/Email/i).fill(`e2e-${Date.now()}@example.com`);
    await this.createContactButton.click();
    await expect(
      this.page.getByRole('heading', { name: /New Contact/i }),
    ).toBeHidden({ timeout: 15000 });
    await this.waitForContactsToLoad();
    await expect(
      this.page.getByRole('row').filter({ hasText: contactName }).first(),
    ).toBeVisible({ timeout: 15000 });
  }

  /**
   * Create a new contact column with given name, key and type
   */
  async createContactColumn(
    columnName: string,
    columnKey: string,
    columnType: string,
  ) {
    await this.page.goto('/contacts');
    await this.page.getByRole('button', { name: 'Add column' }).click();
    await this.page.getByPlaceholder('Field name').fill(columnName);
    await this.page.getByPlaceholder(/Unique column key/i).fill(columnKey);
    await this.page.getByLabel(/Field Type/i).selectOption(columnType);
    await this.page.getByRole('button', { name: 'Create field' }).click();
    await expect(
      this.page.getByText(/Column created successfully/i),
    ).toBeVisible();
  }

  /**
   * Wait for details page to load and return the contact ID from url
   */
  async waitForDetailsPageToLoad() {
    await this.page.waitForURL(/\/contacts\/\d+/, { timeout: 30000 });
    await this.page.waitForLoadState('domcontentloaded');
    const match = this.page.url().match(/\/contacts\/(\d+)/);
    if (!match?.[1]) {
      throw new Error(
        `Failed to extract contact ID from URL: ${this.page.url()}`,
      );
    }
    return Number(match[1]);
  }
}

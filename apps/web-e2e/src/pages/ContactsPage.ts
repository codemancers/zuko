import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

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
    this.newContactButton = page.getByRole('button', { name: 'New Contact' });
    this.contactsList = page.locator('table').or(page.locator('main'));
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
    // Table rows in tbody (excluding header row)
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
    await this.page
      .waitForSelector('table', { timeout: 5000 })
      .catch(() => null);
  }

  /**
   * Create a new contact and return the table row index
   */
  async createNewContact() {
    await this.page.waitForLoadState('networkidle');
    const initialRowCount = await this.getRowCount();
    await this.createNewRecord();
    // Wait for the new row to appear in the DOM before returning its index
    await this.page
      .getByRole('row')
      .nth(initialRowCount)
      .waitFor({ state: 'visible', timeout: 10000 });
    return initialRowCount; // 0-indexed, new row index will be equal to initial row count
  }

  /**
   * Create a new contact row with given name
   */
  async createContactRow(contactName: string) {
    await this.page.goto('/contacts');
    await this.page.waitForLoadState('networkidle');
    const initialRowCount = await this.page.locator('tbody tr').count();

    await this.page.getByRole('button', { name: 'Add row' }).click();
    await expect(this.page.locator('tbody tr')).toHaveCount(
      initialRowCount + 1,
    );

    // Find the 'name' column index
    const nameIndex = await this.getColumnIndex('name');

    const lastRow = this.page.locator('tbody tr').last();
    const nameCell = lastRow.locator('td').nth(nameIndex);
    await nameCell.evaluate((node) => (node as any).click());

    const input = nameCell.locator('input');
    await input.waitFor({ state: 'visible' });
    await input.fill(contactName);
    await input.press('Enter');
    await expect(this.page.getByText(contactName)).toBeVisible();
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
    await this.page.getByLabel('Field Name').fill(columnName);
    await this.page.getByLabel('Column Key').fill(columnKey);
    await this.page.getByLabel('Field Type').selectOption(columnType);
    await this.page.getByRole('button', { name: 'Create field' }).click();
    await expect(
      this.page.getByRole('columnheader', { name: columnName }),
    ).toBeVisible();
  }

  /**
   * Wait for details page to load and return the contact ID from url
   */
  async waitForDetailsPageToLoad() {
    await this.page.waitForURL(/\/contacts\/\d+$/, { timeout: 10000 });
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

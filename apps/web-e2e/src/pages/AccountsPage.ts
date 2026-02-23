import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for Accounts page
 */
export class AccountsPage extends BasePage {
  readonly newAccountButton: Locator;
  readonly accountsList: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    super(page);
    this.newAccountButton = page.getByRole('button', { name: 'New Account' });
    this.accountsList = page.locator('table').or(page.locator('main'));
    this.searchInput = page.getByPlaceholder(/Search accounts/i);
  }

  /**
   * Navigate to the accounts page
   */
  async goto() {
    await super.goto('/accounts');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Click the new account button
   */
  async clickNewAccount() {
    await this.newAccountButton.click();
  }

  /**
   * Search for an account by company name
   */
  async searchAccount(name: string) {
    await this.searchInput.fill(name);
  }

  /**
   * Get all account items from the table
   */
  async getAccountItems() {
    return this.page.locator('tbody tr').all();
  }

  /**
   * Click on an account by company name
   */
  async clickAccount(companyName: string) {
    await this.page.getByText(companyName, { exact: false }).click();
  }

  /**
   * Wait for accounts to load
   */
  async waitForAccountsToLoad() {
    await this.page.waitForSelector('tbody tr, text=No accounts found', { timeout: 5000 }).catch(() => {
      // If neither appears, table might be empty which is also valid
    });
  }
}

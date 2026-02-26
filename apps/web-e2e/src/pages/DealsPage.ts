import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class DealsPage extends BasePage {
  readonly newDealButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    super(page);
    this.newDealButton = page.getByRole('button', { name: /New Deal/i });
    this.searchInput = page.getByPlaceholder(/Search deals/i);
  }

  async goto() {
    await super.goto('/deals');
    await this.waitForDealsToLoad();
  }

  async clickNewDeal() {
    await this.newDealButton.click();
  }

  async searchDeal(query: string) {
    await this.searchInput.fill(query);
  }

  async getDealItems() {
    await this.waitForDealsToLoad();
    // Find all table rows except the header
    const rows = this.page.locator('table tbody tr');
    return rows.all();
  }

  async waitForDealsToLoad() {
    // Wait for either deals table or empty state
    await Promise.race([
      this.page
        .waitForSelector('table tbody tr', { timeout: 5000 })
        .catch(() => null),
      this.page
        .waitForSelector('text=No Deals', { timeout: 5000 })
        .catch(() => null),
    ]);
  }
}

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class DealsPage extends BasePage {
  readonly newDealButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    super(page);
    this.newDealButton = page.getByRole('button', { name: /New Deal/i });
    this.searchInput = page.getByPlaceholder(/Search deals/i);
  }

  override async goto() {
    await super.goto('/deals');
    await this.waitForDealsToLoad();
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
    await this.page
      .waitForSelector('table', { timeout: 5000 })
      .catch(() => null);
  }

  /**
   * Create a new deal and return the table row index
   */
  async createNewDeal() {
    await this.page.waitForLoadState('networkidle');
    const initialRowCount = await this.getRowCount();
    await this.createNewRecord();
    // Wait for the new row to appear in the DOM before returning its index
    await this.page
      .getByRole('row')
      .nth(initialRowCount)
      .waitFor({ state: 'visible', timeout: 30000 });
    return initialRowCount; // 0-indexed, new row index will be equal to initial row count
  }

  /**
   * Create a new deal row with given name
   */
  async createDealRow(dealName: string) {
    await this.page.goto('/deals');
    await this.page.waitForLoadState('networkidle');
    // Wait for the table body to be visible and stable before counting rows
    await this.page
      .locator('tbody')
      .waitFor({ state: 'visible', timeout: 15000 });
    await this.page
      .waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, {
        timeout: 15000,
      })
      .catch(() => null); // tolerate empty table (zero rows is valid)
    const initialRowCount = await this.page.locator('tbody tr').count();

    await this.page.getByRole('button', { name: 'Add row' }).click();
    await expect(this.page.locator('tbody tr')).toHaveCount(
      initialRowCount + 1,
      { timeout: 15000 },
    );

    // Find the 'title' column index
    const titleIndex = await this.getColumnIndex('title');

    const lastRow = this.page.locator('tbody tr').last();
    const titleCell = lastRow.locator('td').nth(titleIndex);
    await titleCell.evaluate((node) => (node as any).click());

    const input = titleCell.locator('input');
    await input.waitFor({ state: 'visible' });
    await input.fill(dealName);
    await input.press('Enter');
    await expect(this.page.getByText(dealName)).toBeVisible();
  }

  /**
   * Wait for details page to load and return the deal ID from url
   */
  async waitForDetailsPageToLoad() {
    await this.page.waitForURL(/\/deals\/\d+/, { timeout: 30000 });
    await this.page.waitForLoadState('domcontentloaded');
    const match = this.page.url().match(/\/deals\/(\d+)/);
    if (!match?.[1]) {
      throw new Error(`Failed to extract deal ID from URL: ${this.page.url()}`);
    }
    return Number(match[1]);
  }

  /**
   * Click on a deal's link to view details
   */
  async clickDeal(row: Locator) {
    await row.locator('a[href^="/deals/"]').click();
  }
}

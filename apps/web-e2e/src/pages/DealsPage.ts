import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class DealsPage extends BasePage {
  readonly newDealButton: Locator;
  readonly searchInput: Locator;
  readonly createDealButton: Locator;
  readonly dealTitleInput: Locator;

  constructor(page: Page) {
    super(page);
    this.newDealButton = page
      .getByRole('button', { name: /New Deal/i })
      .first();
    this.searchInput = page.getByPlaceholder(/Search deals/i);
    this.createDealButton = page.getByRole('button', {
      name: /^Create Deal$/i,
    });
    this.dealTitleInput = page.getByLabel(/Deal Title/i);
  }

  override async goto() {
    await super.goto('/deals');
    await this.waitForDealsToLoad();
    await this.page.waitForLoadState('networkidle');
  }

  async searchDeal(query: string) {
    await this.searchInput.fill(query);
  }

  async getDealItems() {
    await this.waitForDealsToLoad();
    const table = this.page.locator('table');
    if ((await table.count()) === 0) {
      return [];
    }
    return this.page.locator('table tbody tr').all();
  }

  async waitForDealsToLoad() {
    await Promise.race([
      this.page.waitForSelector('table', { timeout: 10000 }),
      this.page.getByText(/No deals yet/i).waitFor({ timeout: 10000 }),
    ]).catch(() => null);
  }

  /**
   * Create a new deal and return the table row index
   */
  async createNewDeal(dealName = `New Deal ${Date.now()}`) {
    await this.page.waitForLoadState('networkidle');
    await this.createNewRecord(dealName);
    return dealName;
  }

  /**
   * Create a new deal row with given name
   */
  async createDealRow(dealName: string) {
    await this.createNewRecord(dealName);
    await expect(
      this.page.getByRole('row').filter({ hasText: dealName }).first(),
    ).toBeVisible();
  }

  override async createNewRecord(dealName = `New Deal ${Date.now()}`) {
    if (!this.page.url().endsWith('/deals')) {
      await this.goto();
      await this.page.waitForLoadState('networkidle');
    }
    await this.newDealButton.click();

    const sheetTitle = this.page.getByRole('heading', { name: /New Deal/i });
    await expect(sheetTitle).toBeVisible({ timeout: 10000 });
    await this.dealTitleInput.fill(dealName);
    const createResponse = this.page.waitForResponse(
      (resp) =>
        resp.url().includes('/deals') &&
        resp.request().method() === 'POST' &&
        resp.ok(),
      { timeout: 15000 },
    );
    await this.createDealButton.click();
    await createResponse;

    await expect(sheetTitle).toBeHidden({ timeout: 15000 });
    // Search for the deal to ensure it's visible regardless of pagination/sort order
    await this.searchDeal(dealName);
    await this.waitForDealsToLoad();
    await expect(
      this.page.getByRole('row').filter({ hasText: dealName }).first(),
    ).toBeVisible({ timeout: 15000 });
  }

  /**
   * Wait for details page to load and return the deal ID from url
   */
  async waitForDetailsPageToLoad() {
    if (!/\/deals\/\d+/.test(this.page.url())) {
      await this.page
        .waitForURL(/\/deals\/\d+/, { timeout: 5000 })
        .catch(async () => {
          const link = this.page.locator('a[href^="/deals/"]').first();
          const href = await link.getAttribute('href');
          if (!href) {
            throw new Error(
              `Failed to navigate to deal detail from URL: ${this.page.url()}`,
            );
          }
          await this.page.goto(href);
        });
    }
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
    const link = row.locator('a[href^="/deals/"]').first();
    // Wait for the link to be visible and stable
    await expect(link).toBeVisible({ timeout: 10000 });

    const href = await link.getAttribute('href');
    if (!href) {
      throw new Error('Deal row link is missing an href');
    }

    await link.click({ force: true });
    await this.page
      .waitForURL(/\/deals\/\d+/, { timeout: 5000 })
      .catch(async () => {
        await this.page.goto(href);
      });
  }
}

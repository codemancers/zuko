import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for Companies page
 */
export class CompaniesPage extends BasePage {
  readonly newCompanyButton: Locator;
  readonly companiesList: Locator;
  readonly searchInput: Locator;
  readonly companyNameInput: Locator;
  readonly createCompanyButton: Locator;

  constructor(page: Page) {
    super(page);
    this.newCompanyButton = page
      .getByRole('button', { name: 'New Company' })
      .first();
    this.companiesList = page.locator('table').or(page.locator('main'));
    this.searchInput = page.getByPlaceholder(/Search companies/i);
    this.companyNameInput = page.getByLabel(/Company Name/i);
    this.createCompanyButton = page.getByRole('button', {
      name: /^Create Company$/i,
    });
  }

  /**
   * Navigate to the companies page
   */
  override async goto() {
    await super.goto('/companies');
    // Wait for page to be fully loaded and interactive
    await this.page.waitForLoadState('domcontentloaded');
    // Wait for either the table or the main content to be visible
    await this.page.waitForSelector('table, main', { state: 'visible' });
  }

  /**
   * Search for a company by name
   */
  async searchCompany(name: string) {
    await this.searchInput.fill(name);
  }

  /**
   * Get all company items from the table
   */
  async getCompanyItems() {
    const table = this.page.locator('table');
    if ((await table.count()) === 0) {
      return [];
    }
    return this.page.locator('tbody tr').all();
  }

  /**
   * Click on a company name
   */
  async clickCompany(row: Locator) {
    await row.locator('a[href^="/companies/"]').click();
  }

  /**
   * Wait for companies to load
   */
  async waitForCompaniesToLoad() {
    await Promise.race([
      this.page.waitForSelector('table', { timeout: 10000 }),
      this.page.getByText(/No companies yet/i).waitFor({ timeout: 10000 }),
    ]).catch(() => null);
  }

  /**
   * Create a new company and return the table row index
   */
  async createNewCompany(companyName = `New Company ${Date.now()}`) {
    await this.createNewRecord(companyName);
    return companyName;
  }

  override async createNewRecord(companyName = `New Company ${Date.now()}`) {
    await this.newCompanyButton.click();
    await expect(
      this.page.getByRole('heading', { name: /New Company/i }),
    ).toBeVisible();
    await this.companyNameInput.fill(companyName);
    await this.createCompanyButton.click();
    await expect(
      this.page.getByRole('heading', { name: /New Company/i }),
    ).toBeHidden({ timeout: 15000 });
    await this.waitForCompaniesToLoad();
    await expect(
      this.page.getByRole('row').filter({ hasText: companyName }).first(),
    ).toBeVisible({ timeout: 15000 });
  }

  /**
   * Wait for details page to load and return the company ID from url
   */
  async waitForDetailsPageToLoad() {
    await this.page.waitForURL(/\/companies\/\d+$/, { timeout: 30000 });
    await this.page.waitForLoadState('domcontentloaded');
    const match = this.page.url().match(/\/companies\/(\d+)/);
    if (!match?.[1]) {
      throw new Error(
        `Failed to extract company ID from URL: ${this.page.url()}`,
      );
    }
    return Number(match[1]);
  }
}

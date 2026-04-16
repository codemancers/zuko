import { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * Page Object Model for Companies page
 */
export class CompaniesPage extends BasePage {
  readonly newCompanyButton: Locator;
  readonly companiesList: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    super(page);
    this.newCompanyButton = page.getByRole("button", { name: "New Company" });
    this.companiesList = page.locator("table").or(page.locator("main"));
    this.searchInput = page.getByPlaceholder(/Search companies/i);
  }

  /**
   * Navigate to the companies page
   */
  override async goto() {
    await super.goto("/companies");
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
    return this.page.locator("tbody tr").all();
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
    await this.page
      .waitForSelector("table", { timeout: 5000 })
      .catch(() => null);
  }

  /**
   * Create a new company and return the table row index
   */
  async createNewCompany() {
    const initialRowCount = await this.getRowCount();
    await this.createNewRecord();
    return initialRowCount;  // 0-indexed, new row index will be equal to initial row count
  }

  /**
   * Wait for details page to load and return the company ID from url
   */
  async waitForDetailsPageToLoad() {
    await this.page.waitForURL(/\/companies\/\d+$/, { timeout: 10000 });
    await this.page.waitForLoadState('domcontentloaded');
    const match = this.page.url().match(/\/companies\/(\d+)/);
    if (!match?.[1]) {
      throw new Error(
        `Failed to extract company ID from URL: ${this.page.url()}`
      );
    }
    return Number(match[1]);
  }
}

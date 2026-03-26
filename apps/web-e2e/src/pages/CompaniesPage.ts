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
   * Click the new company button
   */
  async clickNewCompany() {
    await this.newCompanyButton.click();
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
   * Click on a company by name
   */
  async clickCompany(companyName: string) {
    await this.page.getByText(companyName, { exact: false }).click();
  }

  /**
   * Wait for companies to load
   */
  async waitForCompaniesToLoad() {
    await this.page
      .waitForSelector("table", { timeout: 5000 })
      .catch(() => null);
  }
}

import { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

export class DealsPage extends BasePage {
  readonly newDealButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    super(page);
    this.newDealButton = page.getByRole("button", { name: /New Deal/i });
    this.searchInput = page.getByPlaceholder(/Search deals/i);
  }

  override async goto() {
    await super.goto("/deals");
    await this.waitForDealsToLoad();
  }

  async clickNewDeal() {
    await this.page.goto('/deals/new');
  }

  async searchDeal(query: string) {
    await this.searchInput.fill(query);
  }

  async getDealItems() {
    await this.waitForDealsToLoad();
    // Find all table rows except the header
    const rows = this.page.locator("table tbody tr");
    return rows.all();
  }

  async waitForDealsToLoad() {
    await this.page
      .waitForSelector("table", { timeout: 5000 })
      .catch(() => null);
  }

  async addRow() {
    const addRowButton = this.page.getByRole("button", { name: /Add row/i });
    await addRowButton.click();
  }
}

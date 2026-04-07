import { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

export class MeetingsPage extends BasePage {
  readonly heading: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: "Meetings", exact: true });
    this.searchInput = page.getByPlaceholder(/Search meetings/i);
  }

  override async goto() {
    await super.goto("/meetings");
    await this.waitForMeetingsToLoad();
  }

  async searchMeetings(query: string) {
    await this.searchInput.fill(query);
  }

  async getMeetingItems() {
    await this.waitForMeetingsToLoad();
    return this.page.locator("table tbody tr").all();
  }

  async waitForMeetingsToLoad() {
    await Promise.race([
      this.page
        .waitForSelector("text=No Meetings Found", { timeout: 5000 })
        .catch(() => null),
      this.page
        .waitForSelector("text=Weekly Product Sync", { timeout: 5000 })
        .catch(() => null),
      this.page
        .waitForSelector("table tbody tr", { timeout: 5000 })
        .catch(() => null),
    ]);
  }
}

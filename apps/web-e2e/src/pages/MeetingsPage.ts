import { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

export class MeetingsPage extends BasePage {
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly sortSelect: Locator;
  readonly addMeetingLink: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /meetings/i });
    this.searchInput = page.getByPlaceholder(/Search meetings/i);
    this.sortSelect = page.getByRole("combobox");
    this.addMeetingLink = page.getByRole("link", { name: /add to a meeting/i });
  }

  override async goto() {
    await super.goto("/meetings");
    await this.waitForMeetingsToLoad();
  }

  async clickAddMeeting() {
    await this.addMeetingLink.click();
  }

  async searchMeetings(query: string) {
    await this.searchInput.fill(query);
  }

  async getMeetingItems() {
    await this.waitForMeetingsToLoad();
    return this.page.locator("ul li.group").all();
  }

  async waitForMeetingsToLoad() {
    await Promise.race([
      this.page
        .waitForSelector("text=No meetings found", { timeout: 5000 })
        .catch(() => null),
      this.page
        .waitForSelector("text=Weekly Product Sync", { timeout: 5000 })
        .catch(() => null),
      this.page
        .waitForSelector("ul li.group", { timeout: 5000 })
        .catch(() => null),
    ]);
  }
}

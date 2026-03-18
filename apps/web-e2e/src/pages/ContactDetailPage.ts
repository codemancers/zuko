import { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * Page Object Model for Contact Detail page with Activity Timeline
 */
export class ContactDetailPage extends BasePage {
  // Activity Timeline selectors
  readonly activitySection: Locator;
  readonly activityItems: Locator;
  readonly commentInput: Locator;
  readonly postCommentButton: Locator;
  readonly activityAvatars: Locator;
  readonly connectingLines: Locator;

  constructor(page: Page) {
    super(page);
    // Use a more specific selector for the activity section
    this.activitySection = page.locator('h2:has-text("Activity")').first();
    this.activityItems = page.locator('[data-testid="activity-item"]');
    this.commentInput = page.getByPlaceholder("Add a comment...");
    this.postCommentButton = page.getByRole("button", {
      name: /Post Comment/i,
    });
    this.activityAvatars = page.locator('[data-testid="activity-avatar"]');
    this.connectingLines = page.locator(
      '[data-testid="activity-connecting-line"]',
    );
  }

  /**
   * Navigate to a contact detail page.
   * Skips navigation if already on this contact to avoid "interrupted by about:blank" when the page is reused.
   */
  override async goto(contactId: number | string) {
    const path = `/contacts/${contactId}`;
    if (this.page.url().includes(path)) {
      // If already on the page, just ensure the activity section is loaded
      await this.page.waitForLoadState('domcontentloaded');
      await this.activitySection.waitFor({ state: 'visible' });
      return;
    }
    await this.page.goto(path);
    await this.page.waitForLoadState('domcontentloaded');
    await this.activitySection.waitFor({ state: 'visible' });
  }

  /**
   * Check if activity section is visible
   */
  async isActivitySectionVisible(): Promise<boolean> {
    return this.activitySection.isVisible();
  }

  /**
   * Get all activity items
   */
  async getActivityItems() {
    return this.activityItems.all();
  }

  /**
   * Get count of activity items
   */
  async getActivityCount(): Promise<number> {
    return this.activityItems.count();
  }

  /**
   * Get the text of an activity item by index
   */
  async getActivityText(index: number): Promise<string> {
    const items = await this.activityItems.all();
    if (items[index]) {
      return (await items[index].textContent()) || "";
    }
    return "";
  }

  /**
   * Get activity author name by index
   */
  async getActivityAuthor(index: number): Promise<string> {
    const items = await this.activityItems.all();
    if (items[index]) {
      const text = await items[index].textContent();
      // Extract name before timestamp (e.g., "John Doe 2 minutes ago")
      const match = text?.match(/^([^0-9]+)/);
      return match ? match[1].trim() : "";
    }
    return "";
  }

  /**
   * Create a new comment
   */
  async createComment(text: string) {
    await this.commentInput.fill(text);
    // Set up the response wait *before* clicking to avoid missing fast responses in CI.
    const createResp = this.page.waitForResponse((resp) => {
      if (!resp.url().includes("/activities/comments")) return false;
      const status = resp.status();
      return status >= 200 && status < 300;
    });

    await this.postCommentButton.click();
    await createResp;
  }

  /**
   * Check if comment input is visible
   */
  async isCommentInputVisible(): Promise<boolean> {
    return this.commentInput.isVisible();
  }

  /**
   * Check if post button is disabled
   */
  async isPostButtonDisabled(): Promise<boolean> {
    return this.postCommentButton.isDisabled();
  }

  /**
   * Edit a comment by index
   */
  async editComment(index: number, newContent: string) {
    const items = await this.activityItems.all();
    if (items[index]) {
      // Click edit button
      const editButton = items[index]
        .getByRole("button", { name: /edit/i })
        .or(items[index].locator('button[title="Edit comment"]'));
      await editButton.click();

      // Wait for textarea to appear
      const textarea = items[index].locator("textarea");
      await textarea.waitFor({ state: "visible" });

      // Clear and type new content
      await textarea.fill(newContent);

      // Click save button
      const saveButton = items[index].getByRole("button", { name: /^Save$/i });
      await saveButton.click();

      // Wait for edit mode to close (textarea should disappear)
      await textarea.waitFor({ state: "detached", timeout: 10000 });
    }
  }

  /**
   * Cancel editing a comment by index
   */
  async cancelEditComment(index: number) {
    const items = await this.activityItems.all();
    if (items[index]) {
      // Click cancel button
      const cancelButton = items[index].getByRole("button", {
        name: /cancel/i,
      });
      await cancelButton.click();

      // Wait for edit mode to close (textarea should disappear)
      const textarea = items[index].locator("textarea");
      await textarea.waitFor({ state: "detached", timeout: 5000 });
    }
  }

  /**
   * Check if edit button exists for a comment at index
   */
  async hasEditButton(index: number): Promise<boolean> {
    const items = await this.activityItems.all();
    if (items[index]) {
      const editButton = items[index]
        .getByRole("button", { name: /edit/i })
        .or(items[index].locator('button[title="Edit comment"]'));
      return editButton.isVisible().catch(() => false);
    }
    return false;
  }

  /**
   * Check if a comment is in edit mode
   */
  async isCommentInEditMode(index: number): Promise<boolean> {
    const items = await this.activityItems.all();
    if (items[index]) {
      const textarea = items[index].locator("textarea");
      return textarea.isVisible().catch(() => false);
    }
    return false;
  }

  /**
   * Check if avatars are displayed
   */
  async hasAvatars(): Promise<boolean> {
    const count = await this.activityAvatars.count();
    return count > 0;
  }

  /**
   * Get avatar for activity at index
   */
  async getAvatar(index: number): Promise<Locator | null> {
    const items = await this.activityItems.all();
    if (items[index]) {
      const avatar = items[index]
        .locator('[data-testid="activity-avatar"]')
        .first();
      return avatar;
    }
    return null;
  }

  /**
   * Verify timeline has connecting lines
   */
  async hasConnectingLines(): Promise<boolean> {
    const count = await this.connectingLines.count();
    return count > 0;
  }

  /**
   * Get the latest (most recent) activity text
   */
  async getLatestActivity(): Promise<string> {
    return this.getActivityText(0);
  }

  /**
   * Wait for a new activity to appear
   */
  async waitForNewActivity(previousCount: number, timeout = 5000) {
    // Use web-first assertion instead of waitForFunction with timeout fallback
    await this.page
      .locator('[data-testid="activity-item"]')
      .nth(previousCount)
      .waitFor({
        state: "visible",
        timeout,
      });
  }

  /**
   * Check if "No activity yet" message is shown
   */
  async hasNoActivityMessage(): Promise<boolean> {
    const message = this.page.getByText("No activity yet");
    return message.isVisible().catch(() => false);
  }
}

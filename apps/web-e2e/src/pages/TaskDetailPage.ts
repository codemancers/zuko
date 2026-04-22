import { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * Page Object Model for Task Detail page with Activity Timeline
 */
export class TaskDetailPage extends BasePage {
  // Activity Timeline selectors
  readonly activitySection: Locator;
  readonly activityItems: Locator;
  readonly commentInput: Locator;
  readonly postCommentButton: Locator;
  readonly taskTitle: Locator;
  readonly taskDescription: Locator;

  constructor(page: Page) {
    super(page);
    this.activitySection = page.locator('h2:has-text("Activity")').first();
    this.activityItems = page.locator('[data-testid="activity-item"]');
    this.commentInput = page.getByPlaceholder("Add a comment...");
    this.postCommentButton = page.getByRole("button", {
      name: /Post Comment/i,
    });
    this.taskTitle = page.locator('h1[contenteditable="true"]');
    this.taskDescription = page.locator('#task-description-editor .ce-paragraph[contenteditable="true"]').first();
  }

  override async goto(taskId: number | string) {
    const path = `/tasks/${taskId}`;
    if (this.page.url().includes(path)) {
      await this.page.waitForLoadState("domcontentloaded");
      await this.activitySection.waitFor({ state: "visible" });
      return;
    }
    await this.page.goto(path);
    await this.page.waitForLoadState("domcontentloaded");
    await this.activitySection.waitFor({ state: "visible" });
  }

  async isActivitySectionVisible(): Promise<boolean> {
    return this.activitySection.isVisible();
  }

  async getActivityCount(): Promise<number> {
    await this.waitForActivityItem().catch(() => null);
    return this.activityItems.count();
  }

  async getActivityText(index: number): Promise<string> {
    const items = await this.activityItems.all();
    if (items[index]) {
      return (await items[index].textContent()) || "";
    }
    return "";
  }

  async createComment(text: string) {
    await this.commentInput.fill(text);
    const createResp = this.page.waitForResponse((resp) => {
      if (!resp.url().includes("/activities/comments")) return false;
      const status = resp.status();
      return status >= 200 && status < 300;
    });
    await this.postCommentButton.click();
    await createResp;
  }

  async isCommentInputVisible(): Promise<boolean> {
    return this.commentInput.isVisible();
  }

  async isPostButtonDisabled(): Promise<boolean> {
    return this.postCommentButton.isDisabled();
  }

  async editComment(index: number, newContent: string) {
    const items = await this.activityItems.all();
    if (items[index]) {
      const editButton = items[index]
        .getByRole("button", { name: /edit/i })
        .or(items[index].locator('button[title="Edit comment"]'));
      await editButton.click();

      const textarea = items[index].locator("textarea");
      await textarea.waitFor({ state: "visible" });
      await textarea.fill(newContent);

      const saveButton = items[index].getByRole("button", { name: /^Save$/i });
      await saveButton.click();

      await textarea.waitFor({ state: "detached", timeout: 10000 });
    }
  }

  async cancelEditComment(index: number) {
    const items = await this.activityItems.all();
    if (items[index]) {
      const cancelButton = items[index].getByRole("button", {
        name: /cancel/i,
      });
      await cancelButton.click();

      const textarea = items[index].locator("textarea");
      await textarea.waitFor({ state: "detached", timeout: 5000 });
    }
  }

  async hasNoActivityMessage(): Promise<boolean> {
    const message = this.page.getByText("No activity yet");
    return message.isVisible().catch(() => false);
  }

  async waitForActivityItem(timeout = 10000) {
    await this.page
      .locator('[data-testid="activity-item"]')
      .or(this.page.getByText("No activity yet"))
      .first()
      .waitFor({ state: "visible", timeout });
  }

  async updateDescription(newDescription: string) {
    await this.taskDescription.waitFor({ state: 'visible' });
    await this.taskDescription.click();
    await this.page.keyboard.press('Control+a');
    await this.page.keyboard.type(newDescription);
    await this.taskDescription.blur();
    // Wait for autosave debounce (2000ms) to fire
    await this.page.waitForTimeout(3000);
  }

  /**
   * Update a task property inline and wait for the PATCH response.
   */
  async updateProperty(label: string, value: string, taskId: number) {
    await this.updateEntityProperty(label, value, `/tasks/${taskId}`);
  }

  /**
   * Update the task title (h1 contenteditable) inline and wait for save.
   */
  async updateTaskTitle(title: string, taskId: number) {
    const patchPromise = this.page.waitForResponse(
      (resp) =>
        resp.url().includes(`/tasks/${taskId}`) &&
        resp.request().method() === "PATCH",
      { timeout: 10000 },
    );
    await this.updateTitle(title);
    await patchPromise;
  }
}

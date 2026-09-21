import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/** Page Object Model for the Lead Detail page and its activity timeline. */
export class LeadDetailPage extends BasePage {
  readonly activitySection: Locator;
  readonly activityItems: Locator;
  readonly commentInput: Locator;
  readonly postCommentButton: Locator;
  readonly convertButton: Locator;

  constructor(page: Page) {
    super(page);
    this.activitySection = page.getByRole('heading', {
      name: 'Activity',
      exact: true,
    });
    this.activityItems = page.locator('[data-testid="activity-item"]');
    this.commentInput = page.getByPlaceholder('Add a comment...');
    this.postCommentButton = page.getByRole('button', {
      name: /Post Comment/i,
    });
    this.convertButton = page.getByRole('button', { name: /Convert to Deal/i });
  }

  override async goto(leadId: number | string) {
    const path = `/leads/${leadId}`;
    if (!this.page.url().includes(path)) {
      await this.page.goto(path);
    }
    await this.page.waitForLoadState('domcontentloaded');
    await this.activitySection.waitFor({ state: 'visible' });
  }

  async isActivitySectionVisible(): Promise<boolean> {
    return this.activitySection.isVisible();
  }

  async getActivityCount(): Promise<number> {
    await this.waitForActivityItem().catch(() => null);
    return this.activityItems.count();
  }

  async createComment(text: string) {
    await this.commentInput.fill(text);
    const createResp = this.page.waitForResponse((resp) => {
      if (!resp.url().includes('/activities/comments')) return false;
      const status = resp.status();
      return status >= 200 && status < 300;
    });
    await this.postCommentButton.click();
    await createResp;
  }

  async isPostButtonDisabled(): Promise<boolean> {
    return this.postCommentButton.isDisabled();
  }

  async waitForActivityItem(timeout = 10000) {
    await this.page
      .locator('[data-testid="activity-item"]')
      .or(this.page.getByText('No activity yet'))
      .first()
      .waitFor({ state: 'visible', timeout });
  }
}

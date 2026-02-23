import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class DealDetailPage extends BasePage {
  readonly editButton: Locator;
  readonly hideButton: Locator;
  readonly dealTitle: Locator;
  readonly dealStage: Locator;
  readonly dealValue: Locator;

  constructor(page: Page, dealId?: number) {
    super(page, dealId ? `/deals/${dealId}` : '/deals');
    this.editButton = page.getByRole('button', { name: /^Edit$/i });
    this.hideButton = page.getByRole('button', { name: /Hide/i });
    this.dealTitle = page.locator('h1');
    this.dealStage = page.locator('span').filter({ hasText: /Prospecting|Qualification|Proposal|Negotiation|Closed/i }).first();
    this.dealValue = page.getByText(/\$/);
  }

  async goto(dealId: number) {
    await this.page.goto(`/deals/${dealId}`);
  }

  async clickEdit() {
    await this.editButton.click();
  }

  async clickHide() {
    await this.hideButton.click();
  }

  async getDealValue(): Promise<string> {
    return await this.dealValue.textContent() || '';
  }

  async getDealStage(): Promise<string> {
    return await this.dealStage.textContent() || '';
  }

  async getActivityItems() {
    const activitySection = this.page.locator('text=Activity').locator('..');
    const items = activitySection.locator('[data-activity-item]');
    return items.all();
  }

  async postComment(comment: string) {
    // Find comment input (textarea or input for comments)
    const commentInput = this.page.locator('textarea[placeholder*="comment" i], input[placeholder*="comment" i]').first();
    await commentInput.fill(comment);

    // Find and click post/submit button
    const postButton = this.page.getByRole('button', { name: /Post|Submit|Send/i });
    await postButton.click();
  }
}

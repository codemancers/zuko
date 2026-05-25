import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class DealDetailPage extends BasePage {
  readonly editButton: Locator;
  readonly hideButton: Locator;
  readonly dealTitle: Locator;
  readonly dealStage: Locator;
  readonly dealValue: Locator;
  readonly activitySection: Locator;
  readonly activityItems: Locator;
  readonly commentInput: Locator;
  readonly postCommentButton: Locator;
  readonly summaryField: Locator;
  readonly hideHistoryButton: Locator;

  constructor(page: Page) {
    super(page);
    this.editButton = page.getByRole('button', { name: /^Edit$/i });
    this.hideButton = page.getByRole('button', { name: /Hide/i });
    this.dealTitle = page.locator('h1[contenteditable="true"]');
    this.dealStage = page
      .locator('span')
      .filter({
        hasText: /Prospecting|Qualification|Proposal|Negotiation|Closed/i,
      })
      .first();
    this.dealValue = page.getByText(/\$/);
    this.activitySection = page.locator('h2:has-text("Activity")').first();
    this.activityItems = page.locator('[data-testid="activity-item"]');
    this.commentInput = page.getByPlaceholder('Add a comment...');
    this.postCommentButton = page.getByRole('button', {
      name: /Post Comment/i,
    });
    this.summaryField = page
      .locator('#deal-summary-editor .ce-paragraph[contenteditable="true"]')
      .first();
    this.hideHistoryButton = page.getByRole('button', {
      name: /Hide History/i,
    });
  }

  override async goto(dealId: number | string) {
    const path = `/deals/${dealId}`;
    // Always navigate to ensure clean state between tests (e.g. no leftover
    // open dialogs from a previous test in the same describe block).
    // networkidle waits for both the page load and all API fetches (deal data,
    // associations, etc.) to complete, ensuring React has rendered everything
    // before assertions run. The EditorJS h1[contenteditable] was too slow on
    // CI and its timeout competed with the overall test budget.
    await this.page.goto(path, { waitUntil: 'networkidle', timeout: 45000 });
  }

  /**
   * Update a deal property inline and wait for the PATCH response.
   */
  async updateProperty(label: string, value: string, dealId: number) {
    await this.updateEntityProperty(label, value, `/deals/${dealId}`);
  }

  /**
   * Update the deal name (h1 contenteditable) inline and wait for save.
   */
  async updateDealName(name: string, dealId: number) {
    const patchPromise = this.page.waitForResponse(
      (resp) =>
        resp.url().includes(`/deals/${dealId}`) &&
        resp.request().method() === 'PATCH',
      { timeout: 10000 },
    );
    await this.updateTitle(name);
    await patchPromise;
  }

  /**
   * Update the summary textarea and wait for save.
   */
  async updateSummary(summary: string, dealId: number) {
    const patchPromise = this.page.waitForResponse(
      (resp) =>
        resp.url().includes(`/deals/${dealId}`) &&
        resp.request().method() === 'PATCH',
      { timeout: 10000 },
    );
    await this.summaryField.waitFor({ state: 'visible' });
    await this.summaryField.click();
    await this.page.keyboard.press('Control+a');
    await this.page.keyboard.type(summary);
    await this.summaryField.blur();
    await patchPromise;
  }

  async clickEdit() {
    await this.editButton.click();
  }

  async clickHide() {
    await this.hideButton.click();
  }

  async getDealValue(): Promise<string> {
    return (await this.dealValue.textContent()) || '';
  }

  async getDealStage(): Promise<string> {
    return (await this.dealStage.textContent()) || '';
  }

  /**
   * Scroll to the Activity section & open the history accordion.
   */
  override async openActivityHistory() {
    await this.page
      .getByRole('heading', { name: 'Activity', exact: true })
      .scrollIntoViewIfNeeded();
    await this.showHistory();
  }

  async isActivitySectionVisible(): Promise<boolean> {
    try {
      await this.activitySection.waitFor({ state: 'visible', timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  async getActivityItems() {
    return this.activityItems.all();
  }

  async getActivityCount(): Promise<number> {
    return this.activityItems.count();
  }

  async isPostButtonDisabled(): Promise<boolean> {
    return this.postCommentButton.isDisabled();
  }

  async hasNoActivityMessage(): Promise<boolean> {
    const message = this.page.getByText('No activity yet');
    return message.isVisible().catch(() => false);
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

  async editComment(index: number, newContent: string) {
    const items = await this.activityItems.all();
    if (items[index]) {
      const editButton = items[index]
        .getByRole('button', { name: /edit/i })
        .or(items[index].locator('button[title="Edit comment"]'));
      await editButton.click();

      const textarea = items[index].locator('textarea');
      await textarea.waitFor({ state: 'visible' });
      await textarea.fill(newContent);

      const saveButton = items[index].getByRole('button', { name: /^Save$/i });
      await saveButton.click();

      await textarea.waitFor({ state: 'detached', timeout: 10000 });
    }
  }

  async cancelEditComment(index: number) {
    const items = await this.activityItems.all();
    if (items[index]) {
      const cancelButton = items[index].getByRole('button', {
        name: /cancel/i,
      });
      await cancelButton.click();

      const textarea = items[index].locator('textarea');
      await textarea.waitFor({ state: 'detached', timeout: 5000 });
    }
  }

  async postComment(comment: string) {
    await this.commentInput.waitFor({ state: 'visible', timeout: 15000 });
    await this.commentInput.fill(comment);
    await this.postCommentButton.click();
  }

  /**
   * Remove a contact from the deal.
   * Clicks the Remove button in the confirmation dialog and waits for it to close.
   */
  async removeContact(contactName: string) {
    const section = this.page
      .getByRole('heading', { name: 'Associated Contacts' })
      .locator('..')
      .locator('..');
    let contactRow = section
      .locator('div.flex')
      .filter({ has: this.page.getByTitle('Remove contact') });
    if (contactName) {
      contactRow = contactRow.filter({
        has: this.page.getByRole('link', {
          name: new RegExp(
            contactName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            'i',
          ),
        }),
      });
    }
    contactRow = contactRow.first();

    await contactRow.getByTitle('Remove contact').click();

    const confirmButton = this.page.getByRole('button', { name: /^Remove$/ });
    await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
    await confirmButton.click();

    // Dialog closes automatically once the mutation succeeds
    await confirmButton.waitFor({ state: 'hidden', timeout: 10000 });
    await contactRow.waitFor({ state: 'detached', timeout: 10000 });
  }

  /**
   * Remove a company from the deal.
   * Clicks the Remove button in the confirmation dialog and waits for it to close.
   */
  async removeCompany(companyName: string) {
    const section = this.page
      .getByRole('heading', { name: 'Associated Companies' })
      .locator('..')
      .locator('..');
    let companyRow = section
      .locator('div.flex')
      .filter({ has: this.page.getByTitle('Remove company') });
    if (companyName) {
      companyRow = companyRow.filter({
        has: this.page.getByRole('link', {
          name: new RegExp(
            companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            'i',
          ),
        }),
      });
    }
    companyRow = companyRow.first();

    await companyRow.getByTitle('Remove company').click();

    const confirmButton = this.page.getByRole('button', { name: /^Remove$/ });
    await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
    await confirmButton.click();

    // Dialog closes automatically once the mutation succeeds
    await confirmButton.waitFor({ state: 'hidden', timeout: 10000 });
    await companyRow.waitFor({ state: 'detached', timeout: 10000 });
  }
}

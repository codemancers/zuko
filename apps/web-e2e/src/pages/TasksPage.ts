import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class TasksPage extends BasePage {
  readonly newTaskButton: Locator;

  constructor(page: Page) {
    super(page);
    this.newTaskButton = page.getByRole('button', { name: /new task/i });
  }

  override async goto() {
    await super.goto('/tasks');
    await this.waitForTasksToLoad();
  }

  async waitForTasksToLoad() {
    await this.page
      .waitForSelector('table', { timeout: 5000 })
      .catch(() => null);
  }

  async getTaskRows() {
    await this.waitForTasksToLoad();
    return this.page.locator('table tbody tr').all();
  }

  async clickNewTask() {
    await this.newTaskButton.click();
  }

  async createTask({
    title,
    description,
    status,
    assignee,
    parentId,
  }: {
    title: string;
    description?: string;
    status?: string;
    assignee?: string;
    parentId?: string;
  }) {
    await this.page.goto('/tasks/new');
    await this.page.getByLabel(/title \*/i).fill(title);
    if (description) {
      await this.page
        .locator('#task-description-editor .ce-paragraph')
        .first()
        .fill(description);
    }
    if (status) {
      await this.page.getByLabel(/status/i).selectOption(status);
    }
    if (assignee) {
      await this.page.getByLabel(/assignee/i).fill(assignee);
    }
    if (parentId) {
      await this.page.getByLabel(/parent task/i).selectOption(parentId);
    }
    await this.page.getByRole('button', { name: /create task/i }).click();
    await this.page.waitForURL('**/tasks', { timeout: 10000 });
  }

  /**
   * Create a new task and return the table row index
   */
  async createNewTask() {
    const initialRowCount = await this.getRowCount();
    await this.createNewRecord();
    return initialRowCount; // 0-indexed
  }

  async clickTask(row: Locator) {
    await row.locator('a[href^="/tasks/"]').first().click();
  }

  /**
   * Wait for details page to load and return the task ID from url
   */
  async waitForDetailsPageToLoad() {
    await this.page.waitForURL(/\/tasks\/\d+$/, { timeout: 10000 });
    await this.page.waitForLoadState('domcontentloaded');
    const match = this.page.url().match(/\/tasks\/(\d+)/);
    if (!match?.[1]) {
      throw new Error(`Failed to extract task ID from URL: ${this.page.url()}`);
    }
    return Number(match[1]);
  }

  async openTask(title: string) {
    await this.page.getByText(title).first().click();
    await this.page.waitForURL('**/tasks/**');
    return this.page.url().match(/\/tasks\/(\d+)$/)?.[1];
  }

  async clickTaskActionEdit(title: string) {
    await this.openTask(title);
    await this.page.getByRole('button', { name: /edit/i }).click();
    await this.page.waitForURL('**/tasks/**/edit');
  }

  async clickTaskActionComplete(title: string) {
    const row = this.page.getByRole('row').filter({ hasText: title }).first();
    await row.getByRole('button', { name: /mark complete/i }).click();
  }

  async clickTaskActionDelete(title: string) {
    const row = this.page.getByRole('row').filter({ hasText: title }).first();
    await row.getByRole('button', { name: /delete task/i }).click();
  }
}

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
      await this.page.getByPlaceholder(/optional description/i).fill(description);
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

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
    await Promise.race([
      this.page
        .waitForSelector('table tbody tr', { timeout: 5000 })
        .catch(() => null),
      this.page
        .waitForSelector('text=No Tasks', { timeout: 5000 })
        .catch(() => null),
    ]);
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

  /** Open the action dropdown for a task row by title and select an action */
  async openTaskActions(title: string) {
    const row = this.page.getByRole('row').filter({ hasText: title }).first();
    await row.getByRole('button', { name: /task actions|more options/i }).click();
  }

  async clickTaskActionEdit(title: string) {
    await this.openTaskActions(title);
    await this.page.getByRole('menuitem', { name: /^edit$/i }).click();
  }

  async clickTaskActionComplete(title: string) {
    await this.openTaskActions(title);
    await this.page.getByRole('menuitem', { name: /^complete$/i }).click();
  }

  async clickTaskActionDelete(title: string) {
    await this.openTaskActions(title);
    await this.page.getByRole('menuitem', { name: /^delete$/i }).click();
  }
}

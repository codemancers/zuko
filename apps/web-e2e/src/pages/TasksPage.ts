import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class TasksPage extends BasePage {
  readonly newTaskButton: Locator;
  readonly createTaskButton: Locator;
  readonly taskTitleInput: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    super(page);
    this.newTaskButton = page
      .getByRole('button', { name: /new task/i })
      .first();
    this.createTaskButton = page.getByRole('button', {
      name: /^Create Task$/i,
    });
    this.taskTitleInput = page.getByLabel(/Title \*/i);
    this.searchInput = page.getByPlaceholder(/Search tasks/i);
  }

  async searchTask(query: string) {
    await this.searchInput.fill(query);
    await this.waitForTasksToLoad();
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
    const table = this.page.locator('table');
    if ((await table.count()) === 0) {
      return [];
    }
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
    // Only navigate if not already on tasks page
    if (!this.page.url().endsWith('/tasks')) {
      await this.goto();
      await this.page.waitForLoadState('networkidle');
    }

    const createBtn = this.page
      .getByRole('button', { name: /new task/i })
      .first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    const sheetTitle = this.page.getByRole('heading', { name: /New Task/i });
    await expect(sheetTitle).toBeVisible({ timeout: 10000 });

    await this.taskTitleInput.fill(title);
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
      const assigneeInput = this.page.getByLabel(/assignee/i);
      await assigneeInput.fill(assignee);
      const exactOption = this.page
        .getByRole('option', { name: assignee, exact: true })
        .first();
      if (await exactOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await exactOption.click();
      } else {
        await assigneeInput.clear();
        await assigneeInput.press('Escape');
      }
    }
    if (parentId) {
      await this.page.getByLabel(/parent task/i).selectOption(parentId);
    }
    const createResponse = this.page.waitForResponse(
      (resp) =>
        resp.url().includes('/tasks') &&
        resp.request().method() === 'POST' &&
        resp.ok(),
      { timeout: 15000 },
    );
    await this.createTaskButton.click();
    await createResponse;
    await expect(sheetTitle).toBeHidden({ timeout: 15000 });

    if (parentId) {
      return;
    }

    // Search for top-level tasks to ensure they're visible in the main list.
    // Subtasks are intentionally shown on the parent detail page instead.
    await this.searchTask(title);
    await expect(
      this.page.getByRole('row').filter({ hasText: title }).first(),
    ).toBeVisible({ timeout: 15000 });
  }

  /**
   * Create a new task and return the table row index
   */
  async createNewTask(title = `New Task ${Date.now()}`) {
    await this.createNewRecord(title);
    return title;
  }

  override async createNewRecord(title = `New Task ${Date.now()}`) {
    if (!this.page.url().endsWith('/tasks')) {
      await this.goto();
      await this.page.waitForLoadState('networkidle');
    }

    const createBtn = this.page
      .getByRole('button', { name: /new task/i })
      .first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    const sheetTitle = this.page.getByRole('heading', { name: /New Task/i });
    await expect(sheetTitle).toBeVisible({ timeout: 10000 });
    await this.taskTitleInput.fill(title);
    const createResponse = this.page.waitForResponse(
      (resp) =>
        resp.url().includes('/tasks') &&
        resp.request().method() === 'POST' &&
        resp.ok(),
      { timeout: 15000 },
    );
    await this.createTaskButton.click();
    await createResponse;
    await expect(sheetTitle).toBeHidden({ timeout: 15000 });

    // Search for the task to ensure it's visible
    await this.searchTask(title);
    await expect(
      this.page.getByRole('row').filter({ hasText: title }).first(),
    ).toBeVisible({ timeout: 15000 });
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

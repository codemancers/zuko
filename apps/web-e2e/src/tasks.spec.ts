import { test, expect } from './fixtures';

/**
 * Tasks Feature E2E Tests
 */

test.describe('Tasks Page - Unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects to sign-in when not authenticated', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForURL('**/sign-in**', { timeout: 10000 });
    expect(page.url()).toContain('/sign-in');
  });
});

test.describe('Tasks - CRUD', () => {
  test('displays tasks page with header', async ({ tasksPage, page }) => {
    await tasksPage.goto();
    await expect(page.getByRole('heading', { name: /^Tasks$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add row/i }).first()).toBeVisible();
  });

  test('can create a task and see it in the list', async ({ tasksPage, page }) => {
    await tasksPage.createTask({
      title: 'TEST E2E TASK',
      description: 'Created by E2E test',
      status: 'TODO',
      assignee: 'test@example.com',
    });

    await tasksPage.goto();
    await expect(page.getByText('TEST E2E TASK').first()).toBeVisible();
  });

  test('can view task detail', async ({ tasksPage, page }) => {
    await tasksPage.createTask({ title: 'Detail View Task' });

    await tasksPage.goto();
    await tasksPage.openTask('Detail View Task');

    await expect(page.getByRole('heading', { name: 'Detail View Task' })).toBeVisible();
  });

  test('can edit a task', async ({ tasksPage, page }) => {
    await tasksPage.createTask({ title: 'Task to Edit' });

    await tasksPage.goto();
    await tasksPage.openTask('Task to Edit');

    await page.getByRole('button', { name: /edit/i }).click();
    await page.waitForURL('**/tasks/**/edit');

    await page.getByLabel(/title \*/i).fill('Edited Task Title');
    await page.getByRole('button', { name: /save changes/i }).click();
    await page.waitForURL('**/tasks/**', { timeout: 10000 });

    await expect(page.getByRole('heading', { name: 'Edited Task Title' })).toBeVisible();
  });

  test('can delete a task via confirmation dialog', async ({ tasksPage, page }) => {
    await tasksPage.createTask({ title: 'Task to Delete' });

    await tasksPage.goto();
    await tasksPage.openTask('Task to Delete');

    await page.getByRole('button', { name: /delete/i }).click();

    // Confirm in dialog
    await expect(page.getByText(/delete task/i)).toBeVisible();
    await page.getByRole('button', { name: /^delete$/i }).click();

    await page.waitForURL('**/tasks', { timeout: 10000 });
  });
});

test.describe("Task Detail - Inline Editing", () => { 
  test('can edit task title inline', async ({ taskDetailPage, page }) => {
    const newTitle = `Updated Task Title ${Date.now()}`;
    await taskDetailPage.goto(1);

    const updatePromise = page.waitForResponse(
      (resp) => resp.url().includes("/tasks/1") && resp.request().method() === "PATCH"
    );
    await taskDetailPage.updateTitle(newTitle);
    await updatePromise;

    // Verify immediate UI update
    await expect(taskDetailPage.taskTitle).toHaveText(newTitle);

    // Refresh and verify persistence
    await page.reload();
    await expect(taskDetailPage.taskTitle).toHaveText(newTitle);
  });

  test('can edit task description inline', async ({ taskDetailPage, page }) => {
    const newDescription = `Updated Task Description ${Date.now()}`;
    await taskDetailPage.goto(1);

    const updatePromise = page.waitForResponse(
      (resp) => resp.url().includes("/tasks/1") && resp.request().method() === "PATCH"
    );
    // updateDescription has a hardcoded sleep but we rely on the API wait for safety
    await taskDetailPage.updateDescription(newDescription);
    await updatePromise;

    // Verify immediate UI update (checking the value of the textarea)
    await expect(taskDetailPage.taskDescription).toHaveValue(newDescription);

    // Refresh and verify persistence
    await page.reload();
    await expect(taskDetailPage.taskDescription).toHaveValue(newDescription);
  });
});

test.describe('Task Form Validation', () => {
  test('shows validation error when title is empty', async ({ page }) => {
    await page.goto('/tasks/new');
    await page.getByRole('button', { name: /create task/i }).click();
    await expect(page.getByText(/title is required/i)).toBeVisible();
  });

  test('displays all status options', async ({ page }) => {
    await page.goto('/tasks/new');
    await page.getByRole('combobox', { name: /status/i }).waitFor({ state: 'visible' });
    const options = await page.getByRole('combobox', { name: /status/i }).locator('option').allTextContents();
    expect(options).toEqual(
      expect.arrayContaining(['To Do', 'In Progress', 'Done', 'Cancelled']),
    );
  });

  test('cancel returns to tasks list', async ({ page }) => {
    await page.goto('/tasks/new');
    await page.getByRole('button', { name: /cancel/i }).click();
    await page.waitForURL('**/tasks');
    expect(page.url()).toContain('/tasks');
  });
});

test.describe('Task Actions (table dropdown)', () => {
  test('Edit from action dropdown navigates to edit page', async ({
    tasksPage,
    page,
  }) => {
    await tasksPage.createTask({ title: 'Task for Dropdown Edit' });
    await tasksPage.goto();

    await tasksPage.clickTaskActionEdit('Task for Dropdown Edit');
    await expect(page.getByLabel(/title \*/i)).toHaveValue('Task for Dropdown Edit');
  });

  test('Complete from action dropdown marks task as done', async ({
    tasksPage,
    page,
  }) => {
    await tasksPage.createTask({ title: 'Task to Complete via Dropdown' });
    await tasksPage.goto();

    await tasksPage.clickTaskActionComplete('Task to Complete via Dropdown');
    // Task should show Done badge in the list
    await expect(
      page.getByRole('row').filter({ hasText: 'Task to Complete via Dropdown' }),
    ).toContainText(/done/i);
  });

  test('Delete from action dropdown removes task after confirmation', async ({
    tasksPage,
    page,
  }) => {
    await tasksPage.createTask({ title: 'Task to Delete via Dropdown' });
    await tasksPage.goto();

    await tasksPage.clickTaskActionDelete('Task to Delete via Dropdown');

    await expect(page.getByText(/delete task/i)).toBeVisible();
    await page.getByRole('button', { name: /^delete$/i }).click();

    await page.waitForURL('**/tasks', { timeout: 10000 });
    await expect(
      page.getByRole('row').filter({ hasText: 'Task to Delete via Dropdown' }),
    ).toBeHidden();
  });
});

test.describe('Task Status Workflow', () => {
  test('can progress task through full lifecycle', async ({ tasksPage, page }) => {
    await tasksPage.createTask({ title: 'Lifecycle Task' });

    await tasksPage.goto();
    await tasksPage.openTask('Lifecycle Task');
    const taskId = page.url().match(/\/tasks\/(\d+)$/)?.[1];

    // TODO → IN_PROGRESS
    await page.goto(`/tasks/${taskId}/edit`);
    await page.getByLabel(/status/i).selectOption('IN_PROGRESS');
    await page.getByRole('button', { name: /save changes/i }).click();
    // Wait for redirect to task detail (not edit page) — regex ensures /tasks/123 not /tasks/123/edit
    await page.waitForURL(/\/tasks\/\d+$/, { timeout: 10000 });

    // IN_PROGRESS → DONE
    await page.goto(`/tasks/${taskId}/edit`);
    await page.getByLabel(/status/i).selectOption('DONE');
    await page.getByRole('button', { name: /save changes/i }).click();
    await page.waitForURL(/\/tasks\/\d+$/, { timeout: 10000 });

    await expect(page.getByText('Done', { exact: true }).first()).toBeVisible();
  });
});

test.describe('Hierarchical Tasks', () => {
  test('can create a subtask under a parent', async ({ tasksPage, page }) => {
    await tasksPage.createTask({ title: 'Parent Task' });

    await tasksPage.goto();
    const parentId = await tasksPage.openTask('Parent Task');
    expect(parentId).toBeTruthy();

    await tasksPage.createTask({ title: 'Child Subtask', parentId });

    // Subtasks are not shown in the main list — navigate to parent detail to verify
    await page.goto(`/tasks/${parentId}`);
    await expect(page.getByText('Child Subtask').first()).toBeVisible();
  });

  test('subtasks appear in parent detail view', async ({ tasksPage, page }) => {
    await tasksPage.createTask({ title: 'Parent with Children' });

    await tasksPage.goto();
    const parentId = await tasksPage.openTask('Parent with Children');

    await tasksPage.createTask({ title: 'Sub A', parentId });
    await tasksPage.createTask({ title: 'Sub B', parentId });

    await page.goto(`/tasks/${parentId}`);
    await expect(page.getByText(/subtasks/i)).toBeVisible();
    await expect(page.getByText('Sub A', { exact: true })).toBeVisible();
    await expect(page.getByText('Sub B', { exact: true })).toBeVisible();
  });

  test('can promote subtask to top-level by clearing parent', async ({ tasksPage, page }) => {
    await tasksPage.createTask({ title: 'Parent for Promotion' });

    await tasksPage.goto();
    const parentId = await tasksPage.openTask('Parent for Promotion');

    await tasksPage.createTask({ title: 'Subtask to Promote', parentId });

    // Subtasks are not in the main list — find the subtask via parent detail page
    await page.goto(`/tasks/${parentId}`);
    const subtaskId = await tasksPage.openTask('Subtask to Promote');

    await page.goto(`/tasks/${subtaskId}/edit`);
    await page.getByLabel(/parent task/i).selectOption('');
    await page.getByRole('button', { name: /save changes/i }).click();
    await page.waitForURL('**/tasks/**', { timeout: 10000 });
  });
});

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
    await expect(page.getByRole('button', { name: /new task/i })).toBeVisible();
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
    await expect(page.getByText(/created/i)).toBeVisible();
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

test.describe('Task Form Validation', () => {
  test('shows validation error when title is empty', async ({ page }) => {
    await page.goto('/tasks/new');
    await page.getByRole('button', { name: /create task/i }).click();
    await expect(page.getByText(/title is required/i)).toBeVisible();
  });

  test('displays all status options', async ({ page }) => {
    await page.goto('/tasks/new');
    const options = await page.getByLabel(/status/i).locator('option').allTextContents();
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
    await page.waitForURL('**/tasks/**', { timeout: 10000 });

    // IN_PROGRESS → DONE
    await page.goto(`/tasks/${taskId}/edit`);
    await page.getByLabel(/status/i).selectOption('DONE');
    await page.getByRole('button', { name: /save changes/i }).click();
    await page.waitForURL('**/tasks/**', { timeout: 10000 });

    await expect(page.getByText(/done/i)).toBeVisible();
  });
});

test.describe('Hierarchical Tasks', () => {
  test('can create a subtask under a parent', async ({ tasksPage, page }) => {
    await tasksPage.createTask({ title: 'Parent Task' });

    await tasksPage.goto();
    const parentId = await tasksPage.openTask('Parent Task');
    expect(parentId).toBeTruthy();

    await tasksPage.createTask({ title: 'Child Subtask', parentId });

    await tasksPage.goto();
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
    await expect(page.getByText('Sub A')).toBeVisible();
    await expect(page.getByText('Sub B')).toBeVisible();
  });

  test('can promote subtask to top-level by clearing parent', async ({ tasksPage, page }) => {
    await tasksPage.createTask({ title: 'Parent for Promotion' });

    await tasksPage.goto();
    const parentId = await tasksPage.openTask('Parent for Promotion');

    await tasksPage.createTask({ title: 'Subtask to Promote', parentId });

    await tasksPage.goto();
    const subtaskId = await tasksPage.openTask('Subtask to Promote');

    await page.goto(`/tasks/${subtaskId}/edit`);
    await page.getByLabel(/parent task/i).selectOption('');
    await page.getByRole('button', { name: /save changes/i }).click();
    await page.waitForURL('**/tasks/**', { timeout: 10000 });
  });
});

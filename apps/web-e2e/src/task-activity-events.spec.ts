import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { TasksPage } from './pages/TasksPage';

/**
 * Task Activity Timeline - System Events
 *
 * Verifies that task lifecycle actions produce the correct system events
 * in the activity timeline: task_created, task_status_changed, field_update.
 */

/** Wait for the POST /tasks response and return the created task's ID */
async function createAndGetTaskId(
  page: Page,
  tasksPage: TasksPage,
  opts: Parameters<TasksPage['createTask']>[0],
): Promise<number> {
  const responsePromise = page.waitForResponse(
    (resp) =>
      resp.url().includes('/tasks') &&
      resp.request().method() === 'POST' &&
      resp.ok(),
    { timeout: 15000 },
  );
  await tasksPage.createTask(opts);
  const response = await responsePromise;
  const createdTask = await response.json();
  return createdTask.id;
}

test.describe('Task Activity Timeline - System Events', () => {
  // ── task_created ──────────────────────────────────────────────────────────

  test.describe('task_created', () => {
    test("shows 'created this task' after a new task is created", async ({
      tasksPage,
      taskDetailPage,
      page,
    }) => {
      const taskId = await createAndGetTaskId(page, tasksPage, {
        title: `Activity Event Task ${Date.now()}`,
      });
      await taskDetailPage.goto(taskId);
      await taskDetailPage.showHistory();

      await expect(
        page
          .locator('[data-testid="activity-item"]')
          .filter({ hasText: /created this task/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // ── task_status_changed ───────────────────────────────────────────────────

  test.describe('task_status_changed', () => {
    test("shows 'moved task from X to Y' after status is changed", async ({
      tasksPage,
      taskDetailPage,
      page,
    }) => {
      const taskId = await createAndGetTaskId(page, tasksPage, {
        title: `Status Change Task ${Date.now()}`,
        status: 'TODO',
      });
      await taskDetailPage.goto(taskId);
      await taskDetailPage.updateProperty('Status', 'In Progress', taskId);
      await taskDetailPage.showHistory();

      await taskDetailPage.expectActivityEntry(
        /moved task from To Do to In Progress/i,
      );
    });
  });

  // ── field_update (title) ──────────────────────────────────────────────────

  test.describe('field_update', () => {
    test("shows 'updated title from X to Y' after title is changed", async ({
      tasksPage,
      taskDetailPage,
      page,
    }) => {
      const updatedTitle = `Updated Task ${Date.now()}`;
      const taskId = await createAndGetTaskId(page, tasksPage, {
        title: `Field Update Task ${Date.now()}`,
      });
      await taskDetailPage.goto(taskId);

      await taskDetailPage.updateTaskTitle(updatedTitle, taskId);
      await taskDetailPage.showHistory();

      await taskDetailPage.expectActivityEntry(/updated title from/i);
    });
  });
});

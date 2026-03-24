import { test, expect } from "./fixtures";

/**
 * Task Activity Timeline - System Events
 *
 * Verifies that task lifecycle actions produce the correct system events
 * in the activity timeline: task_created, task_status_changed, field_update.
 */
test.describe("Task Activity Timeline - System Events", () => {
  // ── task_created ──────────────────────────────────────────────────────────

  test.describe("task_created", () => {
    test("shows 'created this task' after a new task is created", async ({
      tasksPage,
      taskDetailPage,
      page,
    }) => {
      const taskTitle = `Activity Event Task ${Date.now()}`;
      await tasksPage.createTask({ title: taskTitle });

      await tasksPage.goto();
      await page.getByText(taskTitle).first().click();
      await page.waitForURL(/\/tasks\/\d+/, { timeout: 10000 });

      await page
        .getByRole("heading", { name: "Activity", exact: true })
        .scrollIntoViewIfNeeded();

      await expect(
        page
          .locator('[data-testid="activity-item"]')
          .filter({ hasText: /created this task/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // ── task_status_changed ───────────────────────────────────────────────────

  test.describe("task_status_changed", () => {
    test("shows 'moved task from X to Y' after status is changed", async ({
      tasksPage,
      taskDetailPage,
      page,
    }) => {
      const taskTitle = `Status Change Task ${Date.now()}`;
      await tasksPage.createTask({ title: taskTitle, status: "TODO" });

      await tasksPage.goto();
      await page.getByText(taskTitle).first().click();
      await page.waitForURL(/\/tasks\/\d+/, { timeout: 10000 });

      // Edit task to change status
      await page.getByRole("button", { name: /edit/i }).click();
      await page.waitForURL(/\/tasks\/\d+\/edit/, { timeout: 10000 });

      await page.getByLabel(/status/i).selectOption("IN_PROGRESS");
      await page.getByRole("button", { name: /save changes/i }).click();
      await page.waitForURL(/\/tasks\/\d+$/, { timeout: 10000 });

      await page
        .getByRole("heading", { name: "Activity", exact: true })
        .scrollIntoViewIfNeeded();

      await expect(
        page
          .locator('[data-testid="activity-item"]')
          .filter({ hasText: /moved task from To Do to In Progress/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // ── field_update (title) ──────────────────────────────────────────────────

  test.describe("field_update", () => {
    test("shows 'updated title from X to Y' after title is changed", async ({
      tasksPage,
      taskDetailPage,
      page,
    }) => {
      const originalTitle = `Field Update Task ${Date.now()}`;
      const updatedTitle = `Updated Task ${Date.now()}`;
      await tasksPage.createTask({ title: originalTitle });

      await tasksPage.goto();
      await page.getByText(originalTitle).first().click();
      await page.waitForURL(/\/tasks\/\d+/, { timeout: 10000 });

      await page.getByRole("button", { name: /edit/i }).click();
      await page.waitForURL(/\/tasks\/\d+\/edit/, { timeout: 10000 });

      const titleInput = page.getByLabel(/title \*/i);
      await titleInput.fill(updatedTitle);
      await page.getByRole("button", { name: /save changes/i }).click();
      await page.waitForURL(/\/tasks\/\d+$/, { timeout: 10000 });

      await page
        .getByRole("heading", { name: "Activity", exact: true })
        .scrollIntoViewIfNeeded();

      await expect(
        page
          .locator('[data-testid="activity-item"]')
          .filter({ hasText: /updated title from/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });
  });
});

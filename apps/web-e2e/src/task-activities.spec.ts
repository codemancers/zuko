import { test, expect } from './fixtures';

/**
 * Task Activity Timeline Tests.
 * Creates a fresh task per describe block to test comment functionality.
 */
test.describe('Task Activity Timeline - Comments', () => {
  let taskId!: number;

  test.beforeEach(async ({ tasksPage, page }) => {
    if (taskId !== undefined) return;

    const taskTitle = `Activity Timeline Task ${Date.now()}`;
    await tasksPage.createTask({ title: taskTitle });

    await tasksPage.goto();
    const taskLink = page.getByText(taskTitle).first();
    await taskLink.click();
    await page.waitForURL(/\/tasks\/\d+/, { timeout: 10000 });
    taskId = parseInt(page.url().match(/\/tasks\/(\d+)/)?.[1] ?? '0', 10);
  });

  // ── 1. Empty states ───────────────────────────────────────────────────────

  test('should display activity timeline section', async ({
    taskDetailPage,
  }) => {
    await taskDetailPage.goto(taskId);
    const isVisible = await taskDetailPage.isActivitySectionVisible();
    expect(isVisible).toBeTruthy();
  });

  test('should display comment input form', async ({
    taskDetailPage,
    page,
  }) => {
    await taskDetailPage.goto(taskId);
    await page
      .getByRole('heading', { name: 'Activity', exact: true })
      .scrollIntoViewIfNeeded();
    await expect(taskDetailPage.commentInput).toBeVisible({ timeout: 10000 });
  });

  test('should disable post button when comment is empty', async ({
    taskDetailPage,
  }) => {
    await taskDetailPage.goto(taskId);
    const isDisabled = await taskDetailPage.isPostButtonDisabled();
    expect(isDisabled).toBeTruthy();
  });

  test('should not submit whitespace-only comments', async ({
    taskDetailPage,
    page,
  }) => {
    await taskDetailPage.goto(taskId);

    // Wait for activity section to stabilize before capturing baseline count
    await page
      .locator('[data-testid="activity-item"]')
      .or(page.getByText("No activity yet"))
      .first()
      .waitFor({ state: "visible", timeout: 10000 });

    const initialCount = await taskDetailPage.getActivityCount();

    await page.getByPlaceholder('Add a comment...').fill('   ');
    const isDisabled = await taskDetailPage.isPostButtonDisabled();
    expect(isDisabled).toBeTruthy();

    const finalCount = await taskDetailPage.getActivityCount();
    expect(finalCount).toBe(initialCount);
  });

  // ── 2. Create comment ─────────────────────────────────────────────────────

  test('should create a new comment successfully', async ({
    taskDetailPage,
  }) => {
    await taskDetailPage.goto(taskId);

    const commentText = `Test comment ${new Date().toISOString()}`;
    await taskDetailPage.createComment(commentText);

    await expect(taskDetailPage.activityItems.last()).toContainText(
      commentText,
      { timeout: 10000 },
    );
  });

  test('should clear input after successful comment submission', async ({
    taskDetailPage,
    page,
  }) => {
    await taskDetailPage.goto(taskId);

    await taskDetailPage.createComment('Comment that should clear');

    const textarea = page.getByPlaceholder('Add a comment...');
    await expect(textarea).toHaveValue('', { timeout: 5000 });
  });

  // ── 3. Edit comment ───────────────────────────────────────────────────────

  test('should successfully edit own comment', async ({
    taskDetailPage,
    page,
  }) => {
    await taskDetailPage.goto(taskId);

    const originalComment = 'Original comment ' + Date.now();
    const editedComment = 'Edited comment ' + Date.now();

    await taskDetailPage.createComment(originalComment);
    await expect(page.getByText(originalComment)).toBeVisible({
      timeout: 10000,
    });

    const items = await taskDetailPage.activityItems.all();
    let editIndex = -1;
    for (let i = 0; i < items.length; i++) {
      const text = await items[i].textContent();
      if (text?.includes(originalComment)) {
        editIndex = i;
        break;
      }
    }
    expect(editIndex).toBeGreaterThanOrEqual(0);
    await taskDetailPage.editComment(editIndex, editedComment);

    await expect(page.getByText(editedComment)).toBeVisible({ timeout: 10000 });
  });

  test('should cancel editing a comment', async ({ taskDetailPage, page }) => {
    await taskDetailPage.goto(taskId);

    const originalComment = 'Cancel edit test ' + Date.now();
    await taskDetailPage.createComment(originalComment);
    await expect(taskDetailPage.activityItems.last()).toContainText(
      originalComment,
      { timeout: 10000 },
    );

    const items = await taskDetailPage.activityItems.all();
    const lastItem = items[items.length - 1];
    const editButton = lastItem.getByRole('button', { name: /edit/i });
    await editButton.click();

    const textarea = lastItem.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 3000 });
    await textarea.fill('This should not be saved');

    const count = await taskDetailPage.getActivityCount();
    await taskDetailPage.cancelEditComment(count - 1);

    await expect(textarea).not.toBeVisible({ timeout: 3000 });
    await expect(taskDetailPage.activityItems.last()).toContainText(
      originalComment,
    );
    await expect(taskDetailPage.activityItems.last()).not.toContainText(
      'This should not be saved',
    );
  });
});

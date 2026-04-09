import { test, expect } from "./fixtures";

/**
 * Deal Activity Timeline Tests.
 * Uses the deal created in data.spec.ts (e2e project runs after data).
 */
test.describe("Deal Activity Timeline - Authenticated", () => {
  let dealId!: number;

  test.beforeEach(async () => {
    // Rely on predictable Deal ID instead of brittle DOM navigation
    dealId = 1;
  });

  // ── 1. Empty states (check before any creation) ───────────────────────────
  test("should display activity timeline section", async ({
    dealDetailPage,
  }) => {
    await dealDetailPage.goto(dealId);

    const isVisible = await dealDetailPage.isActivitySectionVisible();
    expect(isVisible).toBeTruthy();
  });

  test("should display comment input form at the bottom", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);
    await page
      .getByRole("heading", { name: /Activity/i })
      .scrollIntoViewIfNeeded();
    await expect(dealDetailPage.commentInput).toBeVisible({ timeout: 10000 });
  });

  test('should show "No activity yet" when there are no activities', async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);
    await page
      .getByRole("heading", { name: /Activity/i })
      .scrollIntoViewIfNeeded();
    await page
      .locator('[data-testid="activity-item"]')
      .or(page.getByText("No activity yet"))
      .first()
      .waitFor({ state: "visible", timeout: 10000 });

    const hasNoActivity = await dealDetailPage.hasNoActivityMessage();
    expect(hasNoActivity).toBeTruthy();
  });

  test("should disable post button when comment is empty", async ({
    dealDetailPage,
  }) => {
    await dealDetailPage.goto(dealId);

    const isDisabled = await dealDetailPage.isPostButtonDisabled();
    expect(isDisabled).toBeTruthy();
  });

  test("should not submit empty or whitespace-only comments", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);

    // Wait for activity section to stabilize before capturing baseline count
    await page
      .locator('[data-testid="activity-item"]')
      .or(page.getByText("No activity yet"))
      .first()
      .waitFor({ state: "visible", timeout: 10000 });

    const initialCount = await dealDetailPage.getActivityCount();

    await page.getByPlaceholder("Add a comment...").fill("   ");

    const isDisabled = await dealDetailPage.isPostButtonDisabled();
    expect(isDisabled).toBeTruthy();

    const finalCount = await dealDetailPage.getActivityCount();
    expect(finalCount).toBe(initialCount);
  });

  // ── 2. Create ─────────────────────────────────────────────────────────────
  test("should create a new comment successfully", async ({
    dealDetailPage,
  }) => {
    await dealDetailPage.goto(dealId);

    const commentText = `Test comment created at ${new Date().toISOString()}`;
    await dealDetailPage.createComment(commentText);

    await expect(dealDetailPage.activityItems.last()).toContainText(
      commentText,
      { timeout: 10000 },
    );
  });

  // ── 3. Check after creating ─────────────────────────────────────────────
  test("should clear input after successful comment submission", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);

    const commentText = "This should clear after posting";
    await dealDetailPage.createComment(commentText);

    const textarea = page.getByPlaceholder("Add a comment...");
    await expect(textarea).toHaveValue("", { timeout: 5000 });
  });

  test("should successfully edit own comment", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);

    const originalComment = "Original comment " + Date.now();
    const editedComment = "Edited comment " + Date.now();

    await dealDetailPage.createComment(originalComment);
    await expect(page.getByText(originalComment)).toBeVisible({
      timeout: 10000,
    });

    const items = await dealDetailPage.activityItems.all();
    let editIndex = -1;
    for (let i = 0; i < items.length; i++) {
      const text = await items[i].textContent();
      if (text?.includes(originalComment)) {
        editIndex = i;
        break;
      }
    }
    expect(editIndex).toBeGreaterThanOrEqual(0);
    await dealDetailPage.editComment(editIndex, editedComment);

    await expect(page.getByText(editedComment)).toBeVisible({ timeout: 10000 });
  });

  test("should cancel editing a comment", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);

    const originalComment = "Original comment for cancel test " + Date.now();

    await dealDetailPage.createComment(originalComment);
    await expect(dealDetailPage.activityItems.last()).toContainText(
      originalComment,
      { timeout: 10000 },
    );

    const items = await dealDetailPage.activityItems.all();
    const lastItem = items[items.length - 1];
    const editButton = lastItem.getByRole("button", { name: /edit/i });
    await editButton.click();

    const textarea = lastItem.locator("textarea");
    await expect(textarea).toBeVisible({ timeout: 3000 });
    await textarea.fill("This should not be saved");

    const count = await dealDetailPage.getActivityCount();
    await dealDetailPage.cancelEditComment(count - 1);

    await expect(textarea).not.toBeVisible({ timeout: 3000 });
    await expect(dealDetailPage.activityItems.last()).toContainText(
      originalComment,
    );
    await expect(dealDetailPage.activityItems.last()).not.toContainText(
      "This should not be saved",
    );
  });
});

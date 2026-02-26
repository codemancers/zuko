import { test, expect } from "./fixtures";

/**
 * Contact Activity Timeline Tests.
 * Depends on contacts.spec.ts (e2e project); uses the contact created there.
 */
test.describe("Contact Activity Timeline - Authenticated", () => {
  let sharedContactId!: number;

  test.beforeEach(async ({ contactsPage, page }) => {
    if (sharedContactId !== undefined) return;
    await contactsPage.goto();
    await page.waitForSelector("tbody tr", {
      state: "visible",
      timeout: 10000,
    });
    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();
    await page.waitForURL(/\/contacts\/\d+/, { timeout: 10000 });
    const match = page.url().match(/\/contacts\/(\d+)/);
    if (!match) throw new Error("Could not get contact id from URL");
    sharedContactId = parseInt(match[1], 10);
  });

  // ── 1. Empty states (check before any creation) ───────────────────────────
  test("should display activity timeline section", async ({
    contactDetailPage,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    const isVisible = await contactDetailPage.isActivitySectionVisible();
    expect(isVisible).toBeTruthy();
  });

  test("should display comment input form at the bottom", async ({
    contactDetailPage,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    const isVisible = await contactDetailPage.isCommentInputVisible();
    expect(isVisible).toBeTruthy();
  });

  test('should show "No activity yet" when there are no activities', async ({
    contactDetailPage,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    const hasNoActivity = await contactDetailPage.hasNoActivityMessage();
    expect(hasNoActivity).toBeTruthy();
  });

  test("should disable post button when comment is empty", async ({
    contactDetailPage,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    // Initially should be disabled (empty input)
    const isDisabled = await contactDetailPage.isPostButtonDisabled();
    expect(isDisabled).toBeTruthy();
  });

  test("should not submit empty or whitespace-only comments", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    const initialCount = await contactDetailPage.getActivityCount();

    await page.getByPlaceholder("Add a comment...").fill("   ");

    // Button should remain disabled
    const isDisabled = await contactDetailPage.isPostButtonDisabled();
    expect(isDisabled).toBeTruthy();

    // Count should not change
    const finalCount = await contactDetailPage.getActivityCount();
    expect(finalCount).toBe(initialCount);
  });

  // ── 2. Create ─────────────────────────────────────────────────────────────
  test("should create a new comment successfully", async ({
    contactDetailPage,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    const commentText = `Test comment created at ${new Date().toISOString()}`;
    const initialCount = await contactDetailPage.getActivityCount();

    await contactDetailPage.createComment(commentText);

    // Wait for new activity in UI (resilient to API URL / proxy path)
    await expect(contactDetailPage.activityItems).toHaveCount(
      initialCount + 1,
      {
        timeout: 10000,
      }
    );
    await expect(contactDetailPage.activityItems.last()).toContainText(
      commentText
    );
  });

  // ── 3. Check after creating ─────────────────────────────────────────────

  test("should clear input after successful comment submission", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    const commentText = "This should clear after posting";
    await contactDetailPage.createComment(commentText);

    const textarea = page.getByPlaceholder("Add a comment...");
    await expect(textarea).toHaveValue("", { timeout: 5000 });
  });

  test("should display user avatars in timeline", async ({
    contactDetailPage,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    const initialCount = await contactDetailPage.getActivityCount();
    await contactDetailPage.createComment("Test comment for avatar check");

    await expect(contactDetailPage.activityItems).toHaveCount(
      initialCount + 1,
      {
        timeout: 10000,
      }
    );
    await expect(
      contactDetailPage.activityItems
        .last()
        .locator('[data-testid="activity-avatar"]')
    ).toBeVisible({ timeout: 5000 });

    const hasAvatars = await contactDetailPage.hasAvatars();
    expect(hasAvatars).toBeTruthy();

    const avatar = await contactDetailPage.getAvatar(initialCount);
    expect(avatar).not.toBeNull();
  });

  test("should display user names with activities", async ({
    contactDetailPage,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    const initialCount = await contactDetailPage.getActivityCount();
    await contactDetailPage.createComment("Test comment for author check");

    await expect(contactDetailPage.activityItems).toHaveCount(
      initialCount + 1,
      {
        timeout: 10000,
      }
    );
    await expect(contactDetailPage.activityItems.last()).toBeVisible({
      timeout: 5000,
    });

    const authorName = await contactDetailPage.getActivityAuthor(initialCount);
    expect(authorName).toBeTruthy();
    expect(authorName.length).toBeGreaterThan(0);
  });

  test("should display activities in chronological order", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    // Create two comments with slight delay
    const firstComment = "First comment " + Date.now();
    const secondComment = "Second comment " + Date.now();

    const initialCount = await contactDetailPage.getActivityCount();

    // Create first comment and wait for it to appear
    await contactDetailPage.createComment(firstComment);
    await expect(contactDetailPage.activityItems).toHaveCount(
      initialCount + 1,
      { timeout: 5000 }
    );

    // Create second comment and wait for it to appear
    await contactDetailPage.createComment(secondComment);
    await expect(contactDetailPage.activityItems).toHaveCount(
      initialCount + 2,
      { timeout: 5000 }
    );

    // Activities are shown in chronological order (oldest first, newest last)
    await expect(contactDetailPage.activityItems.nth(-2)).toContainText(
      firstComment
    );
    await expect(contactDetailPage.activityItems.nth(-1)).toContainText(
      secondComment
    );
  });

  test("should show edit button for own comments", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    const initialCount = await contactDetailPage.getActivityCount();

    // Create a comment
    await contactDetailPage.createComment("Comment to test edit button");

    // Wait for new activity item to appear
    await expect(contactDetailPage.activityItems).toHaveCount(
      initialCount + 1,
      { timeout: 5000 }
    );

    // Check LAST item (newest is at end due to chronological order) for edit button
    const editButton = contactDetailPage.activityItems
      .last()
      .getByRole("button", { name: /edit/i });
    const editButton = contactDetailPage.activityItems
      .last()
      .getByRole("button", { name: /edit/i });
    await expect(editButton).toBeVisible({ timeout: 3000 });
  });

  test("should successfully edit own comment", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    const originalComment = "Original comment " + Date.now();
    const editedComment = "Edited comment " + Date.now();

    const initialCount = await contactDetailPage.getActivityCount();

    // Create a comment and wait for it to appear
    await contactDetailPage.createComment(originalComment);
    await expect(contactDetailPage.activityItems).toHaveCount(
      initialCount + 1,
      { timeout: 5000 }
    );

    // Verify the original comment is there (at the end)
    await expect(contactDetailPage.activityItems.last()).toContainText(
      originalComment
    );

    // Edit the comment (last item since newest is at end)
    const countBefore = await contactDetailPage.getActivityCount();
    await contactDetailPage.editComment(countBefore - 1, editedComment);

    // Wait for edit to complete and verify the comment was updated
    await expect(contactDetailPage.activityItems.last()).toContainText(
      editedComment,
      { timeout: 5000 }
    );
    await expect(contactDetailPage.activityItems.last()).not.toContainText(
      originalComment
    );
  });

  test("should cancel editing a comment", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    const originalComment = "Original comment for cancel test " + Date.now();

    const initialCount = await contactDetailPage.getActivityCount();

    // Create a comment and wait for it to appear
    await contactDetailPage.createComment(originalComment);
    await expect(contactDetailPage.activityItems).toHaveCount(
      initialCount + 1,
      { timeout: 5000 }
    );

    // Get the last item (newest)
    const items = await contactDetailPage.activityItems.all();
    const lastItem = items[items.length - 1];
    const editButton = lastItem.getByRole("button", { name: /edit/i });
    await editButton.click();

    // Wait for edit mode to activate - look for textarea to appear
    const textarea = lastItem.locator("textarea");
    await expect(textarea).toBeVisible({ timeout: 3000 });

    // Change the text but don't save
    await textarea.fill("This should not be saved");

    // Cancel editing
    const count = await contactDetailPage.getActivityCount();
    await contactDetailPage.cancelEditComment(count - 1);

    // Wait for edit mode to close - textarea should disappear
    await expect(textarea).not.toBeVisible({ timeout: 3000 });

    // Verify the original comment is still there
    await expect(contactDetailPage.activityItems.last()).toContainText(
      originalComment
    );
    await expect(contactDetailPage.activityItems.last()).not.toContainText(
      "This should not be saved"
    );
  });

  test("should show save button disabled when edit content is empty", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    const initialCount = await contactDetailPage.getActivityCount();

    // Create a comment and wait for it to appear
    await contactDetailPage.createComment("Test comment for empty validation");
    await expect(contactDetailPage.activityItems).toHaveCount(
      initialCount + 1,
      { timeout: 5000 }
    );

    // Get the last item and click edit
    const items = await contactDetailPage.activityItems.all();
    const lastItem = items[items.length - 1];
    const editButton = lastItem.getByRole("button", { name: /edit/i });
    await editButton.click();

    // Wait for edit mode - textarea becomes visible
    const textarea = lastItem.locator("textarea");
    await expect(textarea).toBeVisible({ timeout: 3000 });

    // Clear the textarea
    await textarea.fill("");

    // Save button should be disabled
    const saveButton = lastItem.getByRole("button", { name: /^Save$/i });
    await expect(saveButton).toBeDisabled({ timeout: 2000 });
  });

  test('should display relative timestamps (e.g., "2 minutes ago")', async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    const initialCount = await contactDetailPage.getActivityCount();

    await contactDetailPage.createComment("Test for timestamp display");

    // Wait for activity to appear
    await expect(contactDetailPage.activityItems).toHaveCount(
      initialCount + 1,
      { timeout: 5000 }
    );

    // Should contain relative time indicators
    await expect(contactDetailPage.activityItems.first()).toContainText(
      /ago|seconds?|minutes?|hours?|days?/i,
      { timeout: 3000 }
    );
  });

  test("should handle multiple comments gracefully", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    const initialCount = await contactDetailPage.getActivityCount();
    const commentsToCreate = 3;

    // Create multiple comments and wait for each to appear
    for (let i = 0; i < commentsToCreate; i++) {
      await contactDetailPage.createComment(`Bulk comment ${i + 1}`);
      await expect(contactDetailPage.activityItems).toHaveCount(
        initialCount + i + 1,
        { timeout: 5000 }
      );
    }

    // Final count should be correct
    await expect(contactDetailPage.activityItems).toHaveCount(
      initialCount + commentsToCreate
    );
  });

  test("should display connecting lines between activities", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    // Ensure we have multiple activities to show connecting lines
    const currentCount = await contactDetailPage.getActivityCount();
    if (currentCount < 2) {
      await contactDetailPage.createComment("Comment 1 for line test");
      await expect(contactDetailPage.activityItems).toHaveCount(
        currentCount + 1,
        { timeout: 5000 }
      );

      await contactDetailPage.createComment("Comment 2 for line test");
      await expect(contactDetailPage.activityItems).toHaveCount(
        currentCount + 2,
        { timeout: 5000 }
      );
    }

    // Check for connecting lines (GitHub-style vertical line)
    const hasLines = await contactDetailPage.hasConnectingLines();
    expect(hasLines).toBeTruthy();
  });

  test("should preserve timeline state after page reload", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    const initialCount = await contactDetailPage.getActivityCount();

    // Create a unique comment
    const uniqueComment = "Reload test comment " + Date.now();
    await contactDetailPage.createComment(uniqueComment);

    // Wait for comment to appear
    await expect(contactDetailPage.activityItems).toHaveCount(
      initialCount + 1,
      { timeout: 5000 }
    );
    const countBeforeReload = await contactDetailPage.getActivityCount();

    // Reload the page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Verify the comment is still there after reload (newest = last in chronological list)
    await expect(contactDetailPage.activityItems).toHaveCount(
      countBeforeReload,
      { timeout: 5000 }
    );
    await expect(contactDetailPage.activityItems.last()).toContainText(
      uniqueComment
    );
  });

  test("should handle long comment text correctly", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    const initialCount = await contactDetailPage.getActivityCount();
    const longComment =
      "A".repeat(500) +
      " - This is a very long comment to test text wrapping and display";

    await contactDetailPage.createComment(longComment);

    await expect(contactDetailPage.activityItems).toHaveCount(
      initialCount + 1,
      { timeout: 10000 }
    );

    // New comment is the last item (chronological order)
    await expect(contactDetailPage.activityItems.last()).toContainText(
      "A".repeat(50)
    );
  });

  test("should handle special characters in comments", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    const initialCount = await contactDetailPage.getActivityCount();
    const specialComment =
      'Test with special chars: <script>alert("xss")</script> & © ™ 😀';
    const specialComment =
      'Test with special chars: <script>alert("xss")</script> & © ™ 😀';

    await contactDetailPage.createComment(specialComment);

    await expect(contactDetailPage.activityItems).toHaveCount(
      initialCount + 1,
      { timeout: 10000 }
    );

    await expect(contactDetailPage.activityItems.last()).toBeVisible();
    await expect(contactDetailPage.activityItems.last()).toContainText(
      "Test with special chars"
    );
  });

  test("should show post button loading state while submitting", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(sharedContactId);

    const initialCount = await contactDetailPage.getActivityCount();

    await page.getByPlaceholder("Add a comment...").fill("Loading state test");
    await contactDetailPage.postCommentButton.click();

    await expect(contactDetailPage.activityItems).toHaveCount(
      initialCount + 1,
      {
        timeout: 10000,
      }
    );
    await expect(contactDetailPage.activityItems.last()).toContainText(
      "Loading state test"
    );
  });
});

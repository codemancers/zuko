import { test, expect } from './fixtures';
import type { AuthUser } from './lib/auth';

/**
 * Contact Activity Timeline Tests
 * Tests the GitHub-style activity timeline with comments functionality
 */
test.describe('Contact Activity Timeline - Authenticated', () => {
  /**
   * Helper function to create a test contact
   */
  async function createTestContact(page: any, auth: AuthUser, name: string = 'Activity Test Contact') {
    const timestamp = Date.now();

    const response = await page.request.post('/api/proxy/api/contacts', {
      data: {
        name: `${name} ${timestamp}`,
        email: `test-${timestamp}@example.com`,
        ownerIds: [auth.id],
      },
    });

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Failed to create contact: ${response.status()} - ${error}`);
    }

    return response.json();
  }

  /**
   * Helper function to cleanup test contact
   */
  async function cleanupContact(page: any, contactId: number) {
    await page.request.patch(`/api/proxy/api/contacts/${contactId}`, {
      data: { isHidden: true },
    }).catch(() => {
      // Ignore cleanup errors
    });
  }

  test('should display activity timeline section', async ({ contactDetailPage, page, auth }) => {
    const contact = await createTestContact(page, auth);

    await contactDetailPage.goto(contact.id);

    const isVisible = await contactDetailPage.isActivitySectionVisible();
    expect(isVisible).toBeTruthy();

    await cleanupContact(page, contact.id);
  });

  test('should display comment input form at the bottom', async ({ contactDetailPage, page, auth }) => {
    const contact = await createTestContact(page, auth);

    await contactDetailPage.goto(contact.id);

    const isVisible = await contactDetailPage.isCommentInputVisible();
    expect(isVisible).toBeTruthy();

    await cleanupContact(page, contact.id);
  });

  test('should show "No activity yet" when there are no activities', async ({
    contactDetailPage,
    page,
    auth,
  }) => {
    const contact = await createTestContact(page, auth, 'Empty Activity Contact');

    await contactDetailPage.goto(contact.id);

    const hasNoActivity = await contactDetailPage.hasNoActivityMessage();
    expect(hasNoActivity).toBeTruthy();

    await cleanupContact(page, contact.id);
  });

  test('should create a new comment successfully', async ({ contactDetailPage, page, auth }) => {
    const contact = await createTestContact(page, auth);
    await contactDetailPage.goto(contact.id);

    const commentText = `Test comment created at ${new Date().toISOString()}`;
    const initialCount = await contactDetailPage.getActivityCount();

    // Wait for API response when creating comment
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/activities') && resp.ok()
    );
    await contactDetailPage.createComment(commentText);
    await responsePromise;

    // Use web-first assertion to wait for new activity to appear
    await expect(contactDetailPage.activityItems).toHaveCount(initialCount + 1, { timeout: 10000 });

    // Verify the latest activity contains our comment text
    await expect(contactDetailPage.activityItems.last()).toContainText(commentText);

    await cleanupContact(page, contact.id);
  });

  test('should disable post button when comment is empty', async ({ contactDetailPage, page, auth }) => {
    const contact = await createTestContact(page, auth);
    await contactDetailPage.goto(contact.id);

    // Initially should be disabled (empty input)
    const isDisabled = await contactDetailPage.isPostButtonDisabled();
    expect(isDisabled).toBeTruthy();

    await cleanupContact(page, contact.id);
  });

  test('should not submit empty or whitespace-only comments', async ({
    contactDetailPage,
    page,
    auth,
  }) => {
    const contact = await createTestContact(page, auth);
    await contactDetailPage.goto(contact.id);

    const initialCount = await contactDetailPage.getActivityCount();

    // Try to submit whitespace-only comment
    await page.fill('textarea[placeholder="Add a comment..."]', '   ');

    // Button should remain disabled
    const isDisabled = await contactDetailPage.isPostButtonDisabled();
    expect(isDisabled).toBeTruthy();

    // Count should not change
    const finalCount = await contactDetailPage.getActivityCount();
    expect(finalCount).toBe(initialCount);

    await cleanupContact(page, contact.id);
  });

  test('should clear input after successful comment submission', async ({
    contactDetailPage,
    page,
    auth,
  }) => {
    const contact = await createTestContact(page, auth);
    await contactDetailPage.goto(contact.id);

    const commentText = 'This should clear after posting';
    await contactDetailPage.createComment(commentText);

    // Use web-first assertion to wait for input to be cleared
    const textarea = page.locator('textarea[placeholder="Add a comment..."]');
    await expect(textarea).toHaveValue('', { timeout: 5000 });

    await cleanupContact(page, contact.id);
  });

  test('should display user avatars in timeline', async ({ contactDetailPage, page, auth }) => {
    const contact = await createTestContact(page, auth);
    await contactDetailPage.goto(contact.id);

    // Create a comment first to ensure there's activity
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/activities') && resp.ok()
    );
    await contactDetailPage.createComment('Test comment for avatar check');
    await responsePromise;

    // Wait for avatar to appear using web-first assertion
    await expect(contactDetailPage.activityItems.first().locator('[data-testid="avatar"], img, .avatar')).toBeVisible({ timeout: 5000 });

    const hasAvatars = await contactDetailPage.hasAvatars();
    expect(hasAvatars).toBeTruthy();

    // Check that the first activity has an avatar
    const avatar = await contactDetailPage.getAvatar(0);
    expect(avatar).not.toBeNull();

    await cleanupContact(page, contact.id);
  });

  test('should display user names with activities', async ({ contactDetailPage, page, auth }) => {
    const contact = await createTestContact(page, auth);
    await contactDetailPage.goto(contact.id);

    // Create a comment to have activity
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/activities') && resp.ok()
    );
    await contactDetailPage.createComment('Test comment for author check');
    await responsePromise;

    // Wait for author name to be visible
    await expect(contactDetailPage.activityItems.first()).toBeVisible({ timeout: 5000 });

    const authorName = await contactDetailPage.getActivityAuthor(0);
    expect(authorName).toBeTruthy();
    expect(authorName.length).toBeGreaterThan(0);

    await cleanupContact(page, contact.id);
  });

  test('should display activities in chronological order', async ({
    contactDetailPage,
    page,
    auth,
  }) => {
    const contact = await createTestContact(page, auth);
    await contactDetailPage.goto(contact.id);

    // Create two comments with slight delay
    const firstComment = 'First comment ' + Date.now();
    const secondComment = 'Second comment ' + Date.now();

    const initialCount = await contactDetailPage.getActivityCount();

    // Create first comment and wait for it to appear
    await contactDetailPage.createComment(firstComment);
    await expect(contactDetailPage.activityItems).toHaveCount(initialCount + 1, { timeout: 5000 });

    // Create second comment and wait for it to appear
    await contactDetailPage.createComment(secondComment);
    await expect(contactDetailPage.activityItems).toHaveCount(initialCount + 2, { timeout: 5000 });

    // Activities are shown in chronological order (oldest first, newest last)
    await expect(contactDetailPage.activityItems.nth(-2)).toContainText(firstComment);
    await expect(contactDetailPage.activityItems.nth(-1)).toContainText(secondComment);

    await cleanupContact(page, contact.id);
  });

  test('should show edit button for own comments', async ({ contactDetailPage, page, auth }) => {
    const contact = await createTestContact(page, auth);
    await contactDetailPage.goto(contact.id);

    const initialCount = await contactDetailPage.getActivityCount();

    // Create a comment
    await contactDetailPage.createComment('Comment to test edit button');

    // Wait for new activity item to appear
    await expect(contactDetailPage.activityItems).toHaveCount(initialCount + 1, { timeout: 5000 });

    // Check LAST item (newest is at end due to chronological order) for edit button
    const editButton = contactDetailPage.activityItems.last().getByRole('button', { name: /edit/i });
    await expect(editButton).toBeVisible({ timeout: 3000 });

    await cleanupContact(page, contact.id);
  });

  test('should successfully edit own comment', async ({ contactDetailPage, page, auth }) => {
    const contact = await createTestContact(page, auth);
    await contactDetailPage.goto(contact.id);

    const originalComment = 'Original comment ' + Date.now();
    const editedComment = 'Edited comment ' + Date.now();

    const initialCount = await contactDetailPage.getActivityCount();

    // Create a comment and wait for it to appear
    await contactDetailPage.createComment(originalComment);
    await expect(contactDetailPage.activityItems).toHaveCount(initialCount + 1, { timeout: 5000 });

    // Verify the original comment is there (at the end)
    await expect(contactDetailPage.activityItems.last()).toContainText(originalComment);

    // Edit the comment (last item since newest is at end)
    const countBefore = await contactDetailPage.getActivityCount();
    await contactDetailPage.editComment(countBefore - 1, editedComment);

    // Wait for edit to complete and verify the comment was updated
    await expect(contactDetailPage.activityItems.last()).toContainText(editedComment, { timeout: 5000 });
    await expect(contactDetailPage.activityItems.last()).not.toContainText(originalComment);

    await cleanupContact(page, contact.id);
  });

  test('should cancel editing a comment', async ({ contactDetailPage, page, auth }) => {
    const contact = await createTestContact(page, auth);
    await contactDetailPage.goto(contact.id);

    const originalComment = 'Original comment for cancel test ' + Date.now();

    const initialCount = await contactDetailPage.getActivityCount();

    // Create a comment and wait for it to appear
    await contactDetailPage.createComment(originalComment);
    await expect(contactDetailPage.activityItems).toHaveCount(initialCount + 1, { timeout: 5000 });

    // Get the last item (newest)
    const items = await contactDetailPage.activityItems.all();
    const lastItem = items[items.length - 1];
    const editButton = lastItem.getByRole('button', { name: /edit/i });
    await editButton.click();

    // Wait for edit mode to activate - look for textarea to appear
    const textarea = lastItem.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 3000 });

    // Change the text but don't save
    await textarea.fill('This should not be saved');

    // Cancel editing
    const count = await contactDetailPage.getActivityCount();
    await contactDetailPage.cancelEditComment(count - 1);

    // Wait for edit mode to close - textarea should disappear
    await expect(textarea).not.toBeVisible({ timeout: 3000 });

    // Verify the original comment is still there
    await expect(contactDetailPage.activityItems.last()).toContainText(originalComment);
    await expect(contactDetailPage.activityItems.last()).not.toContainText('This should not be saved');

    await cleanupContact(page, contact.id);
  });

  test('should show save button disabled when edit content is empty', async ({ contactDetailPage, page, auth }) => {
    const contact = await createTestContact(page, auth);
    await contactDetailPage.goto(contact.id);

    const initialCount = await contactDetailPage.getActivityCount();

    // Create a comment and wait for it to appear
    await contactDetailPage.createComment('Test comment for empty validation');
    await expect(contactDetailPage.activityItems).toHaveCount(initialCount + 1, { timeout: 5000 });

    // Get the last item and click edit
    const items = await contactDetailPage.activityItems.all();
    const lastItem = items[items.length - 1];
    const editButton = lastItem.getByRole('button', { name: /edit/i });
    await editButton.click();

    // Wait for edit mode - textarea becomes visible
    const textarea = lastItem.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 3000 });

    // Clear the textarea
    await textarea.fill('');

    // Save button should be disabled
    const saveButton = lastItem.getByRole('button', { name: /^Save$/i });
    await expect(saveButton).toBeDisabled({ timeout: 2000 });

    await cleanupContact(page, contact.id);
  });

  test('should display relative timestamps (e.g., "2 minutes ago")', async ({
    contactDetailPage,
    page,
    auth,
  }) => {
    const contact = await createTestContact(page, auth);
    await contactDetailPage.goto(contact.id);

    const initialCount = await contactDetailPage.getActivityCount();

    await contactDetailPage.createComment('Test for timestamp display');

    // Wait for activity to appear
    await expect(contactDetailPage.activityItems).toHaveCount(initialCount + 1, { timeout: 5000 });

    // Should contain relative time indicators
    await expect(contactDetailPage.activityItems.first()).toContainText(/ago|seconds?|minutes?|hours?|days?/i, { timeout: 3000 });

    await cleanupContact(page, contact.id);
  });

  test('should handle multiple comments gracefully', async ({ contactDetailPage, page, auth }) => {
    const contact = await createTestContact(page, auth);
    await contactDetailPage.goto(contact.id);

    const initialCount = await contactDetailPage.getActivityCount();
    const commentsToCreate = 3;

    // Create multiple comments and wait for each to appear
    for (let i = 0; i < commentsToCreate; i++) {
      await contactDetailPage.createComment(`Bulk comment ${i + 1}`);
      await expect(contactDetailPage.activityItems).toHaveCount(initialCount + i + 1, { timeout: 5000 });
    }

    // Final count should be correct
    await expect(contactDetailPage.activityItems).toHaveCount(initialCount + commentsToCreate);

    await cleanupContact(page, contact.id);
  });

  test('should display connecting lines between activities', async ({
    contactDetailPage,
    page,
    auth,
  }) => {
    const contact = await createTestContact(page, auth);
    await contactDetailPage.goto(contact.id);

    // Ensure we have multiple activities to show connecting lines
    const currentCount = await contactDetailPage.getActivityCount();
    if (currentCount < 2) {
      await contactDetailPage.createComment('Comment 1 for line test');
      await expect(contactDetailPage.activityItems).toHaveCount(currentCount + 1, { timeout: 5000 });

      await contactDetailPage.createComment('Comment 2 for line test');
      await expect(contactDetailPage.activityItems).toHaveCount(currentCount + 2, { timeout: 5000 });
    }

    // Check for connecting lines (GitHub-style vertical line)
    const hasLines = await contactDetailPage.hasConnectingLines();
    expect(hasLines).toBeTruthy();

    await cleanupContact(page, contact.id);
  });

  test('should preserve timeline state after page reload', async ({
    contactDetailPage,
    page,
    auth,
  }) => {
    const contact = await createTestContact(page, auth);
    await contactDetailPage.goto(contact.id);

    const initialCount = await contactDetailPage.getActivityCount();

    // Create a unique comment
    const uniqueComment = 'Reload test comment ' + Date.now();
    await contactDetailPage.createComment(uniqueComment);

    // Wait for comment to appear
    await expect(contactDetailPage.activityItems).toHaveCount(initialCount + 1, { timeout: 5000 });
    const countBeforeReload = await contactDetailPage.getActivityCount();

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify the comment is still there after reload
    await expect(contactDetailPage.activityItems).toHaveCount(countBeforeReload, { timeout: 5000 });
    await expect(contactDetailPage.activityItems.first()).toContainText(uniqueComment);

    await cleanupContact(page, contact.id);
  });

  test('should handle long comment text correctly', async ({ contactDetailPage, page, auth }) => {
    const contact = await createTestContact(page, auth);
    await contactDetailPage.goto(contact.id);

    const initialCount = await contactDetailPage.getActivityCount();
    const longComment = 'A'.repeat(500) + ' - This is a very long comment to test text wrapping and display';

    await contactDetailPage.createComment(longComment);

    // Wait for comment to appear
    await expect(contactDetailPage.activityItems).toHaveCount(initialCount + 1, { timeout: 5000 });

    // Verify at least part of the long text is visible
    await expect(contactDetailPage.activityItems.first()).toContainText('A'.repeat(50));

    await cleanupContact(page, contact.id);
  });

  test('should handle special characters in comments', async ({ contactDetailPage, page, auth }) => {
    const contact = await createTestContact(page, auth);
    await contactDetailPage.goto(contact.id);

    const initialCount = await contactDetailPage.getActivityCount();
    const specialComment = 'Test with special chars: <script>alert("xss")</script> & © ™ 😀';

    await contactDetailPage.createComment(specialComment);

    // Wait for comment to appear
    await expect(contactDetailPage.activityItems).toHaveCount(initialCount + 1, { timeout: 5000 });

    // The text should be properly escaped/handled and visible
    await expect(contactDetailPage.activityItems.first()).toBeVisible();
    await expect(contactDetailPage.activityItems.first()).toContainText('Test with special chars');

    await cleanupContact(page, contact.id);
  });

  test('should show post button loading state while submitting', async ({
    contactDetailPage,
    page,
    auth,
  }) => {
    const contact = await createTestContact(page, auth);
    await contactDetailPage.goto(contact.id);

    const initialCount = await contactDetailPage.getActivityCount();

    // Start typing
    await page.fill('textarea[placeholder="Add a comment..."]', 'Loading state test');

    // Wait for API response after clicking submit
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/activities') && resp.ok()
    );
    await contactDetailPage.postCommentButton.click();
    await responsePromise;

    // Verify comment was posted
    await expect(contactDetailPage.activityItems).toHaveCount(initialCount + 1, { timeout: 5000 });
    await expect(contactDetailPage.activityItems.first()).toContainText('Loading state test');

    await cleanupContact(page, contact.id);
  });
});

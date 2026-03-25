import { test, expect } from "./fixtures";

/**
 * Contact Activity Timeline Tests.
 * Creates a fresh contact per describe block to ensure a clean activity state.
 */
test.describe("Contact Activity Timeline - Authenticated", () => {
  let contactId!: number;

  test.beforeEach(async ({ contactsPage, page }) => {
    if (contactId !== undefined) return;

    const contactName = `E2E Comment Test Contact ${Date.now()}`;
    await contactsPage.createContact({
      name: contactName,
      email: `activity-test-${Date.now()}@example.com`,
    });

    await contactsPage.goto();
    const contactLink = page.getByText(contactName).first();
    await contactLink.click();
    await page.waitForURL(/\/contacts\/\d+/, { timeout: 10000 });
    contactId = parseInt(page.url().match(/\/contacts\/(\d+)/)?.[1] ?? "0", 10);
  });

  // ── 1. Empty states (check before any creation) ───────────────────────────
  test("should display activity timeline section", async ({
    contactDetailPage,
  }) => {
    await contactDetailPage.goto(contactId);

    const isVisible = await contactDetailPage.isActivitySectionVisible();
    expect(isVisible).toBeTruthy();
  });

  test("should display comment input form at the bottom", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(contactId);
    await page
      .getByRole("heading", { name: "Activity", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(contactDetailPage.commentInput).toBeVisible({
      timeout: 10000,
    });
  });

  test("should show 'created this contact' system event for a new contact", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(contactId);
    await page
      .getByRole("heading", { name: "Activity", exact: true })
      .scrollIntoViewIfNeeded();

    await expect(
      page
        .locator('[data-testid="activity-item"]')
        .filter({ hasText: /created this contact/i })
        .first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should disable post button when comment is empty", async ({
    contactDetailPage,
  }) => {
    await contactDetailPage.goto(contactId);

    const isDisabled = await contactDetailPage.isPostButtonDisabled();
    expect(isDisabled).toBeTruthy();
  });

  test("should not submit empty or whitespace-only comments", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(contactId);

    const initialCount = await contactDetailPage.getActivityCount();

    await page.getByPlaceholder("Add a comment...").fill("   ");

    const isDisabled = await contactDetailPage.isPostButtonDisabled();
    expect(isDisabled).toBeTruthy();

    const finalCount = await contactDetailPage.getActivityCount();
    expect(finalCount).toBe(initialCount);
  });

  // ── 2. Create ─────────────────────────────────────────────────────────────
  test("should create a new comment successfully", async ({
    contactDetailPage,
  }) => {
    await contactDetailPage.goto(contactId);

    const commentText = `Test comment created at ${new Date().toISOString()}`;
    await contactDetailPage.createComment(commentText);

    await expect(contactDetailPage.activityItems.last()).toContainText(
      commentText,
      { timeout: 10000 },
    );
  });

  // ── 3. Check after creating ─────────────────────────────────────────────

  test("should clear input after successful comment submission", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(contactId);

    const commentText = "This should clear after posting";
    await contactDetailPage.createComment(commentText);

    const textarea = page.getByPlaceholder("Add a comment...");
    await expect(textarea).toHaveValue("", { timeout: 5000 });
  });

  test("should successfully edit own comment", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(contactId);

    const originalComment = "Original comment " + Date.now();
    const editedComment = "Edited comment " + Date.now();

    await contactDetailPage.createComment(originalComment);
    await expect(page.getByText(originalComment)).toBeVisible({
      timeout: 10000,
    });

    const items = await contactDetailPage.activityItems.all();
    let editIndex = -1;
    for (let i = 0; i < items.length; i++) {
      const text = await items[i].textContent();
      if (text?.includes(originalComment)) {
        editIndex = i;
        break;
      }
    }
    expect(editIndex).toBeGreaterThanOrEqual(0);
    await contactDetailPage.editComment(editIndex, editedComment);

    await expect(page.getByText(editedComment)).toBeVisible({ timeout: 10000 });
  });

  test("should cancel editing a comment", async ({
    contactDetailPage,
    page,
  }) => {
    await contactDetailPage.goto(contactId);

    const originalComment = "Original comment for cancel test " + Date.now();

    await contactDetailPage.createComment(originalComment);
    await expect(contactDetailPage.activityItems.last()).toContainText(
      originalComment,
      { timeout: 10000 },
    );

    const items = await contactDetailPage.activityItems.all();
    const lastItem = items[items.length - 1];
    const editButton = lastItem.getByRole("button", { name: /edit/i });
    await editButton.click();

    const textarea = lastItem.locator("textarea");
    await expect(textarea).toBeVisible({ timeout: 3000 });
    await textarea.fill("This should not be saved");

    const count = await contactDetailPage.getActivityCount();
    await contactDetailPage.cancelEditComment(count - 1);

    await expect(textarea).not.toBeVisible({ timeout: 3000 });
    await expect(contactDetailPage.activityItems.last()).toContainText(
      originalComment,
    );
    await expect(contactDetailPage.activityItems.last()).not.toContainText(
      "This should not be saved",
    );
  });
});

import { test, expect } from "./fixtures";

/**
 * Meetings Feature E2E Tests
 * Tests meetings list, add form, detail view, auth redirect, and delete flow
 */

test.describe("Meetings Page - Unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects to sign-in when visiting /meetings", async ({ page }) => {
    await page.goto("/meetings");
    await page.waitForURL("**/sign-in**", { timeout: 10000 });
    await expect(page.locator("h1")).toContainText("Sign in to Zuko");
  });

  test("redirects to sign-in when visiting /meeting/add", async ({ page }) => {
    await page.goto("/meeting/add");
    await page.waitForURL("**/sign-in**", { timeout: 10000 });
    await expect(page.locator("h1")).toContainText("Sign in to Zuko");
  });

  test("redirects to sign-in when visiting /meeting/1", async ({ page }) => {
    await page.goto("/meeting/1");
    await page.waitForURL("**/sign-in**", { timeout: 10000 });
    await expect(page.locator("h1")).toContainText("Sign in to Zuko");
  });
});

test.describe("Meetings - Authenticated", () => {
  test("displays meetings page when authenticated", async ({
    meetingsPage,
    page,
  }) => {
    await meetingsPage.goto();
    expect(page.url()).toContain("/meetings");
    await expect(meetingsPage.heading).toBeVisible();
  });

  test("can view meeting list", async ({ meetingsPage }) => {
    await meetingsPage.goto();
    const items = await meetingsPage.getMeetingItems();
    expect(Array.isArray(items)).toBe(true);
  });

  test("shows at least one meeting with dummy data", async ({
    meetingsPage,
    page,
  }) => {
    await meetingsPage.goto();
    await expect(page.getByText("Weekly Product Sync")).toBeVisible({
      timeout: 10000,
    });
  });

  test("can search meetings", async ({ meetingsPage, page }) => {
    await meetingsPage.goto();
    await meetingsPage.searchMeetings("Product");
    await page.waitForLoadState("load", { timeout: 5000 });
    await expect(page.getByText("Weekly Product Sync")).toBeVisible();
  });

  test("can open inline add meeting form", async ({ meetingsPage, page }) => {
    await meetingsPage.goto();
    await meetingsPage.clickAddMeeting();
    await expect(
      page.getByPlaceholder(/enter meeting name/i)
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByPlaceholder(/paste meeting url/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("add meeting form shows validation for empty name", async ({
    meetingsPage,
    page,
  }) => {
    await meetingsPage.goto();
    await meetingsPage.clickAddMeeting();
    await expect(page.getByPlaceholder(/paste meeting url/i)).toBeVisible({
      timeout: 5000,
    });
    await page.getByPlaceholder(/paste meeting url/i).fill("https://meet.google.com/abc-defg-hij");
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText(/meeting name is required/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("add meeting form shows validation for invalid url", async ({
    meetingsPage,
    page,
  }) => {
    await meetingsPage.goto();
    await meetingsPage.clickAddMeeting();
    await expect(page.getByPlaceholder(/enter meeting name/i)).toBeVisible({
      timeout: 5000,
    });
    await page.getByPlaceholder(/enter meeting name/i).fill("E2E Meeting");
    await page.getByPlaceholder(/paste meeting url/i).fill("http://not-https.com");
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText(/please enter a valid url/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("add meeting Cancel closes inline form", async ({
    meetingsPage,
    page,
  }) => {
    await meetingsPage.goto();
    await meetingsPage.clickAddMeeting();
    await expect(page.getByPlaceholder(/enter meeting name/i)).toBeVisible({
      timeout: 5000,
    });
    await page.getByRole("button", { name: /^cancel$/i }).click();
    await expect(
      page.getByPlaceholder(/enter meeting name/i)
    ).not.toBeVisible();
  });

  test("can open meeting detail from list", async ({
    meetingsPage,
    meetingDetailPage,
    page,
  }) => {
    await meetingsPage.goto();
    await page.getByText("Weekly Product Sync").click();
    await page.waitForURL("**/meeting/**", { timeout: 10000 });
    expect(page.url()).toMatch(/\/meeting\/\d+/);
    await expect(
      page.getByRole("heading", { name: /Weekly Product Sync/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("meeting detail shows tabs", async ({ meetingDetailPage, page }) => {
    await meetingDetailPage.goto("1");
    await expect(page.getByRole("button", { name: /recording/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /transcript/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^chat$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /summary/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /action items/i })).toBeVisible();
  });

  test("meeting detail Transcript tab shows content", async ({
    meetingDetailPage,
    page,
  }) => {
    await meetingDetailPage.goto("1");
    await page.getByRole("button", { name: /transcript/i }).click();
    await expect(page.getByText(/Hello everyone/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("meeting detail Action Items tab shows list and search", async ({
    meetingDetailPage,
    page,
  }) => {
    await meetingDetailPage.goto("1");
    await page.getByRole("button", { name: /action items/i }).click();
    await expect(page.getByText(/of.*items/)).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByPlaceholder(/search action items/i)
    ).toBeVisible();
  });

  test("meeting detail Action Items tab shows Add Task button", async ({
    meetingDetailPage,
    page,
  }) => {
    await meetingDetailPage.goto("1");
    await page.getByRole("button", { name: /action items/i }).click();
    await expect(page.getByRole("button", { name: /add task/i })).toBeVisible({
      timeout: 5000,
    });
  });

  test("can add a task from Action Items tab", async ({
    meetingDetailPage,
    page,
  }) => {
    await meetingDetailPage.goto("1");
    await page.getByRole("button", { name: /action items/i }).click();
    await page.getByRole("button", { name: /add task/i }).click();
    await page.getByPlaceholder(/task title/i).fill("E2E New Task");
    await page.getByPlaceholder(/add more details/i).fill("E2E task description");
    await page.getByRole("button", { name: /save task/i }).click();
    await expect(page.getByText("E2E New Task")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("E2E task description")).toBeVisible();
  });

  test("meeting detail back button returns to list", async ({
    meetingsPage,
    meetingDetailPage,
    page,
  }) => {
    await meetingsPage.goto();
    await page.getByText("Weekly Product Sync").click();
    await page.waitForURL("**/meeting/**", { timeout: 10000 });
    await page.getByRole("button", { name: /meetings/i }).first().click();
    await page.waitForURL("**/meetings", { timeout: 10000 });
    expect(page.url()).toContain("/meetings");
  });

  test("can open delete dialog and cancel", async ({
    meetingsPage,
    page,
  }) => {
    await meetingsPage.goto();
    const moreButtons = page.getByRole("button", { name: /more options/i });
    await moreButtons.first().click();
    await page.getByRole("menuitem", { name: /delete/i }).click();
    await expect(
      page.getByText("Are you sure you want to delete this meeting?")
    ).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /^cancel$/i }).click();
    await expect(
      page.getByText("Are you sure you want to delete this meeting?")
    ).not.toBeVisible();
  });
});

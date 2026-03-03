import { test, expect } from "@playwright/test";

/**
 * Auth redirect tests use storage state from auth setup (Gather-style).
 * Setup does real sign-up and saves .auth/user.json; this project loads it,
 * so the browser sends cookies and no cookie injection is needed.
 */
test.describe("Auth Redirect - Using Test Utils", () => {
  test("authenticated user should be redirected to /chat from homepage", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForURL("**/chat", { timeout: 10000 });
    expect(page.url()).toContain("/chat");
    await expect(
      page.getByRole("textbox", { name: /ask anything/i })
    ).toBeVisible();
  });

  test.describe("unauthenticated", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("unauthenticated user should NOT be redirected to /chat", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForTimeout(1000);
      expect(page.url()).not.toContain("/chat");
    });
  });
});

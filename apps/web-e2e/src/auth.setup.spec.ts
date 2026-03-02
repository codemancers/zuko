import { test as base } from "@playwright/test";
import * as path from "path";

/**
 * Gather-style auth setup: real sign-up in the browser, then save storage state.
 * The "auth" project depends on this and uses storageState: '.auth/user.json',
 * so no cookie injection is needed and cookies are sent (same as Gather).
 */
const test = base.extend<object>({});

test.describe("Auth setup", () => {
  test("sign up and save storage state for authenticated tests", async ({
    page,
  }) => {
    const email = `e2e-setup-${Date.now()}@example.com`;
    const name = "E2E Setup User";
    const password = "TestPassword123!";

    await page.goto("/sign-up");
    await page.getByRole("textbox", { name: /full name/i }).fill(name);
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByRole("button", { name: /create account/i }).click();

    await page.waitForURL("**/chat", { timeout: 60000 });

    const authDir = path.join(__dirname, "..", ".auth");
    await page
      .context()
      .storageState({ path: path.join(authDir, "user.json") });
  });
});

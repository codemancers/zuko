import { test, expect } from "./fixtures";

/**
 * Deal Activity Timeline - System Events
 *
 * Verifies that each deal lifecycle action produces the correct system event
 * in the activity timeline: deal_created, stage_change, company_linked,
 * company_unlinked, contact_linked, contact_unlinked.
 */
test.describe("Deal Activity Timeline - System Events", () => {
  // ── deal_created ────────────────────────────────────────────────────────

  test.describe("deal_created", () => {
    test("shows 'created this deal' after a new deal is created", async ({
      dealsPage,
      page,
    }) => {
      await dealsPage.goto();
      await dealsPage.clickNewDeal();
      await page.waitForURL("**/deals/new", { timeout: 10000 });

      const dealTitle = `Activity Event Test ${Date.now()}`;
      await page.getByLabel(/Deal Title/i).fill(dealTitle);
      await page.getByLabel(/Stage/i).selectOption("prospecting");
      await page.getByRole("button", { name: /Create Deal/i }).click();

      await page.waitForURL("**/deals", { timeout: 10000 });
      await expect(page.getByText(dealTitle)).toBeVisible({ timeout: 10000 });

      // Navigate to the newly created deal
      await page
        .locator('a[href^="/deals/"]')
        .filter({ hasText: dealTitle })
        .click();
      await page.waitForURL(/\/deals\/\d+/, { timeout: 10000 });

      await page
        .getByRole("heading", { name: "Activity", exact: true })
        .scrollIntoViewIfNeeded();

      await expect(
        page
          .locator('[data-testid="activity-item"]')
          .filter({ hasText: /created this deal/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // ── stage_change ─────────────────────────────────────────────────────────

  test.describe("stage_change", () => {
    test("shows 'moved deal from X to Y' after stage is edited", async ({
      dealsPage,
      dealDetailPage,
      page,
    }) => {
      await dealsPage.goto();
      const firstLink = page.locator('a[href^="/deals/"]').first();
      await firstLink.click();
      await page.waitForURL(/\/deals\/\d+/, { timeout: 10000 });

      // Read current stage so we can switch to something different
      const currentStageText = await page
        .locator("span")
        .filter({
          hasText: /Prospecting|Qualification|Proposal|Negotiation|Closed/i,
        })
        .first()
        .textContent();

      const targetStage = /qualification/i.test(currentStageText ?? "")
        ? "proposal"
        : "qualification";

      await dealDetailPage.clickEdit();
      await page.waitForURL(/\/deals\/\d+\/edit/, { timeout: 10000 });

      await page.getByLabel(/Stage/i).selectOption(targetStage);
      await page.getByRole("button", { name: /Save Changes/i }).click();

      await page.waitForURL(/\/deals\/\d+$/, { timeout: 10000 });

      await page
        .getByRole("heading", { name: "Activity", exact: true })
        .scrollIntoViewIfNeeded();

      await expect(
        page
          .locator('[data-testid="activity-item"]')
          .filter({ hasText: /moved deal from/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // ── company_linked / company_unlinked ────────────────────────────────────

  test.describe("company events", () => {
    let dealId: number;

    test.beforeEach(async ({ dealsPage, page }) => {
      await dealsPage.goto();
      const firstLink = page.locator('a[href^="/deals/"]').first();
      await firstLink.click();
      await page.waitForURL(/\/deals\/\d+/, { timeout: 10000 });
      dealId = parseInt(
        page.url().match(/\/deals\/(\d+)/)?.[1] ?? "0",
        10,
      );
    });

    test("shows 'linked company X' after a company is added", async ({
      dealDetailPage,
      page,
    }) => {
      await dealDetailPage.goto(dealId);

      await page.getByRole("button", { name: /Add Company/i }).click();
      await expect(
        page.getByRole("heading", { name: /Add Company to Deal/i }),
      ).toBeVisible();

      const companySelect = page.locator("select").first();
      const optionCount = await companySelect.locator("option").count();

      // Skip if no companies are available to link
      if (optionCount <= 1) {
        await page.getByRole("button", { name: /Cancel/i }).click();
        test.skip();
        return;
      }

      await companySelect.selectOption({ index: 1 });
      await page.getByRole("button", { name: /^Add Company$/i }).click();

      await expect(
        page.getByRole("heading", { name: /Add Company to Deal/i }),
      ).toBeHidden({ timeout: 5000 });

      await page
        .getByRole("heading", { name: "Activity", exact: true })
        .scrollIntoViewIfNeeded();

      await expect(
        page
          .locator('[data-testid="activity-item"]')
          .filter({ hasText: /linked company/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });

    test("shows 'unlinked company X' after a company is removed", async ({
      dealDetailPage,
      page,
    }) => {
      await dealDetailPage.goto(dealId);

      const removeButtons = page.locator('button[title="Remove company"]');
      const count = await removeButtons.count();

      if (count === 0) {
        test.skip();
        return;
      }

      await removeButtons.first().click();
      // Confirm in ConfirmDialog
      const confirmRemoveCompany = page.getByRole("button", { name: /^Remove$/ });
      await confirmRemoveCompany.waitFor({ state: "visible", timeout: 5000 });
      await confirmRemoveCompany.click();
      // Dialog doesn't auto-close after mutation; dismiss so aria-hidden is lifted
      await page.keyboard.press("Escape");

      await page
        .getByRole("heading", { name: "Activity", exact: true })
        .scrollIntoViewIfNeeded();

      await expect(
        page
          .locator('[data-testid="activity-item"]')
          .filter({ hasText: /unlinked company/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // ── contact_linked / contact_unlinked ────────────────────────────────────

  test.describe("contact events", () => {
    let dealId: number;

    test.beforeEach(async ({ dealsPage, page }) => {
      await dealsPage.goto();
      const firstLink = page.locator('a[href^="/deals/"]').first();
      await firstLink.click();
      await page.waitForURL(/\/deals\/\d+/, { timeout: 10000 });
      dealId = parseInt(
        page.url().match(/\/deals\/(\d+)/)?.[1] ?? "0",
        10,
      );
    });

    test("shows 'linked contact X' after a contact is added", async ({
      dealDetailPage,
      page,
    }) => {
      await dealDetailPage.goto(dealId);

      await page.getByRole("button", { name: /Add Contact/i }).click();
      await expect(
        page.getByRole("heading", { name: /Add Contact to Deal/i }),
      ).toBeVisible();

      const contactSelect = page.locator("select").first();
      const optionCount = await contactSelect.locator("option").count();

      if (optionCount <= 1) {
        await page.getByRole("button", { name: /Cancel/i }).click();
        test.skip();
        return;
      }

      await contactSelect.selectOption({ index: 1 });
      await page.getByRole("button", { name: /^Add Contact$/i }).click();

      await expect(
        page.getByRole("heading", { name: /Add Contact to Deal/i }),
      ).toBeHidden({ timeout: 5000 });

      await page
        .getByRole("heading", { name: "Activity", exact: true })
        .scrollIntoViewIfNeeded();

      await expect(
        page
          .locator('[data-testid="activity-item"]')
          .filter({ hasText: /linked contact/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });

    test("shows 'unlinked contact X' after a contact is removed", async ({
      dealDetailPage,
      page,
    }) => {
      await dealDetailPage.goto(dealId);

      const removeButtons = page.locator('button[title="Remove contact"]');
      const count = await removeButtons.count();

      if (count === 0) {
        test.skip();
        return;
      }

      await removeButtons.first().click();
      // Confirm in ConfirmDialog
      const confirmRemoveContact = page.getByRole("button", { name: /^Remove$/ });
      await confirmRemoveContact.waitFor({ state: "visible", timeout: 5000 });
      await confirmRemoveContact.click();
      // Dialog doesn't auto-close after mutation; dismiss so aria-hidden is lifted
      await page.keyboard.press("Escape");

      await page
        .getByRole("heading", { name: "Activity", exact: true })
        .scrollIntoViewIfNeeded();

      await expect(
        page
          .locator('[data-testid="activity-item"]')
          .filter({ hasText: /unlinked contact/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });
  });
});

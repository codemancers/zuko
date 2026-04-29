import { test, expect } from './fixtures';
import { createFreshDeal } from './fixtures/helpers';

/**
 * Deal Activity Timeline - System Events
 *
 * Verifies that each deal lifecycle action produces the correct system event
 * in the activity timeline: deal_created, stage_change, company_linked,
 * company_unlinked, contact_linked, contact_unlinked.
 */
test.describe('Deal Activity Timeline - System Events', () => {
  let dealId: number;

  test.beforeAll(async ({ browser }) => {
    dealId = await createFreshDeal(browser);
  });

  // ── deal_created ────────────────────────────────────────────────────────

  test("shows 'created this deal' after a new deal is created", async ({
    dealsPage,
    dealDetailPage,
    page,
  }) => {
    const dealTitle = `Activity Event Test ${Date.now()}`;
    await dealsPage.goto();

    // Create deal via add row
    await dealsPage.createDealRow(dealTitle);

    // Get the ID of the newly created deal
    const freshDealRow = page
      .getByRole('row')
      .filter({ hasText: dealTitle })
      .first();
    const freshDealLink = freshDealRow.locator('a[href^="/deals/"]');
    await freshDealLink.click();

    await dealsPage.waitForDetailsPageToLoad();

    // Verify activity event on details page
    await dealDetailPage.openActivityHistory();
    await expect(dealDetailPage.hideHistoryButton).toBeVisible();
    await dealDetailPage.expectActivityEntry(/created this deal/i);
  });

  // ── stage_change ─────────────────────────────────────────────────────────

  test("shows 'moved deal from X to Y' after stage is edited", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);
    const defaultNewStage = 'Prospecting';
    const targetStage = 'Qualification';

    await dealDetailPage.openActivityHistory();
    await dealDetailPage.updateProperty('Stage', targetStage, dealId);
    await expect(dealDetailPage.propertyRow('Stage').locator('dd')).toHaveText(
      targetStage,
    );

    // Verify activity entry
    await dealDetailPage.expectActivityEntry(
      `moved deal from ${defaultNewStage} to ${targetStage}`,
    );

    // Verify persistence
    await page.reload();
    const persistedStage = await dealDetailPage.getDealStage();
    expect(persistedStage.toLowerCase()).toBe(targetStage.toLowerCase());
  });

  // ── company_linked / company_unlinked ────────────────────────────────────

  test.describe('company events', () => {
    test("shows 'linked company X' after a company is added", async ({
      dealDetailPage,
      page,
    }) => {
      await dealDetailPage.goto(dealId);

      await page.getByRole('button', { name: /Add Company/i }).click();
      await expect(
        page.getByRole('heading', { name: /Add Company to Deal/i }),
      ).toBeVisible();

      const companySelect = page.locator('select').first();
      const optionCount = await companySelect.locator('option').count();

      // Skip if no companies are available to link
      if (optionCount <= 1) {
        await page.getByRole('button', { name: /Cancel/i }).click();
        test.skip();
        return;
      }

      await companySelect.selectOption({ index: 1 });
      await page.getByRole('button', { name: /^Add Company$/i }).click();

      await expect(
        page.getByRole('heading', { name: /Add Company to Deal/i }),
      ).toBeHidden({ timeout: 5000 });

      await page
        .getByRole('heading', { name: 'Activity', exact: true })
        .scrollIntoViewIfNeeded();
      await dealDetailPage.showHistory();

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
      const confirmRemoveCompany = page.getByRole('button', {
        name: /^Remove$/,
      });
      await confirmRemoveCompany.waitFor({ state: 'visible', timeout: 5000 });
      await confirmRemoveCompany.click();
      // Dialog doesn't auto-close after mutation; dismiss so aria-hidden is lifted
      await page.keyboard.press('Escape');

      await page
        .getByRole('heading', { name: 'Activity', exact: true })
        .scrollIntoViewIfNeeded();
      await dealDetailPage.showHistory();

      await expect(
        page
          .locator('[data-testid="activity-item"]')
          .filter({ hasText: /unlinked company/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // ── contact_linked / contact_unlinked ────────────────────────────────────

  test.describe('contact events', () => {
    test("shows 'linked contact X' after a contact is added", async ({
      dealDetailPage,
      page,
    }) => {
      await dealDetailPage.goto(dealId);

      await page.getByRole('button', { name: /Add Contact/i }).click();
      await expect(
        page.getByRole('heading', { name: /Add Contact to Deal/i }),
      ).toBeVisible();

      const contactSelect = page.locator('select').first();
      const optionCount = await contactSelect.locator('option').count();

      if (optionCount <= 1) {
        await page.getByRole('button', { name: /Cancel/i }).click();
        test.skip();
        return;
      }

      await contactSelect.selectOption({ index: 1 });
      await page.getByRole('button', { name: /^Add Contact$/i }).click();

      await expect(
        page.getByRole('heading', { name: /Add Contact to Deal/i }),
      ).toBeHidden({ timeout: 5000 });

      await page
        .getByRole('heading', { name: 'Activity', exact: true })
        .scrollIntoViewIfNeeded();
      await dealDetailPage.showHistory();

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
      const confirmRemoveContact = page.getByRole('button', {
        name: /^Remove$/,
      });
      await confirmRemoveContact.waitFor({ state: 'visible', timeout: 5000 });
      await confirmRemoveContact.click();
      // Dialog doesn't auto-close after mutation; dismiss so aria-hidden is lifted
      await page.keyboard.press('Escape');

      await page
        .getByRole('heading', { name: 'Activity', exact: true })
        .scrollIntoViewIfNeeded();
      await dealDetailPage.showHistory();

      await expect(
        page
          .locator('[data-testid="activity-item"]')
          .filter({ hasText: /unlinked contact/i })
          .first(),
      ).toBeVisible({ timeout: 10000 });
    });
  });
});

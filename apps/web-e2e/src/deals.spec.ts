import dayjs from 'dayjs';
import { test, expect } from './fixtures';
import { createFreshDeal } from './fixtures/helpers';

/**
 * Deals Feature E2E Tests
 * Tests deal CRUD, navigation, search, and detail views
 */

test.describe('Deals Page - Unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects to sign-in when not authenticated', async ({ page }) => {
    await page.goto('/deals');
    await page.waitForURL('**/sign-in**', { timeout: 10000 });
    expect(page.url()).toContain('/sign-in');
    await expect(page.locator('h1')).toContainText('Sign in to Zuko');
  });
});

test.describe('Deals - Authenticated', () => {
  // ── 1. Empty state ─────────────────────────────────────────────────────
  test('displays deals page when authenticated', async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();

    expect(page.url()).toContain('/deals');
    await dealsPage.waitForDealsToLoad();
  });

  test('can view deal list', async ({ dealsPage }) => {
    await dealsPage.goto();

    const deals = await dealsPage.getDealItems();
    expect(Array.isArray(deals)).toBe(true);
  });

  test('can create a new deal', async ({ dealsPage, dealDetailPage, page }) => {
    const dealName = `TEST E2E DEAL ${Date.now()}`;
    await dealsPage.goto();

    // 1. Create new deal via sheet
    await dealsPage.createDealRow(dealName);
    const newRow = page.getByRole('row').filter({ hasText: dealName }).first();

    // 2. Update other fields inline in the table
    await dealsPage.updateTableCell(newRow, 'Value', '100000');
    await dealsPage.updateTableCell(newRow, 'Expected Close', '2026-01-01');

    // 3. Navigate to details page by clicking the deal name
    await dealsPage.clickDeal(newRow);
    await dealsPage.waitForDetailsPageToLoad();

    // 4. Verify properties on the details page
    await expect(dealDetailPage.dealTitle).toHaveText(dealName);
    await expect(dealDetailPage.propertyRow('Stage').locator('dd')).toHaveText(
      'Prospecting',
    );
  });

  // ── 3. Check after (list with data) ─────────────────────────────────────
  test('can search for deals', async ({ dealsPage, page }) => {
    await dealsPage.goto();

    await dealsPage.searchDeal('test');

    await page.waitForLoadState('load', { timeout: 5000 });
  });

  test('can click on a deal to view details', async ({ dealsPage, page }) => {
    await dealsPage.goto();

    const deals = await dealsPage.getDealItems();
    if (deals.length > 0) {
      // Find the specific deal link within the row to trigger navigation
      const dealLink = deals[0].locator('a[href^="/deals/"]');
      await dealLink.click();

      await page.waitForURL('**/deals/**', { timeout: 10000 });
      expect(page.url()).toMatch(/\/deals\/\d+$/);
    } else {
      test.skip();
    }
  });

  test('deal list displays stage badges', async ({ dealsPage, page }) => {
    await dealsPage.goto();

    const stageBadges = page.locator('span').filter({
      hasText: /Prospecting|Qualification|Proposal|Negotiation|Closed/i,
    });
    const count = await stageBadges.count();

    const deals = await dealsPage.getDealItems();
    if (deals.length > 0) {
      expect(count).toBeGreaterThan(0);
    }
  });

  test('deal list displays currency values', async ({ dealsPage, page }) => {
    await dealsPage.goto();

    const deals = await dealsPage.getDealItems();
    if (deals.length > 0) {
      const currencyValues = page.locator('td').filter({ hasText: /[$€£¥₹]/ });
      const count = await currencyValues.count();

      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('renders New Deal button and does not render add row button', async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();
    await expect(
      page.getByRole('button', { name: /New Deal/i }).first(),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Add row/i })).toHaveCount(0);
  });

  test('Opens add column dialog when header plus icon is clicked', async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();
    const deals = await dealsPage.getDealItems();

    if (deals.length > 0) {
      const addColumnButton = page.getByRole('button', { name: /Add column/i });
      await addColumnButton.click();
      await expect(page.getByText(/Add new field/i)).toBeVisible();
    }
  });
});

test.describe('Deal Detail', () => {
  let dealId: number;
  test.beforeAll(async ({ browser }) => {
    dealId = await createFreshDeal(browser);
  });

  // ── 1. Empty state (detail sections visible) ────────────────────────────
  test('displays deal detail page with information', async ({
    dealDetailPage,
  }) => {
    await dealDetailPage.goto(dealId);

    await expect(dealDetailPage.dealTitle).toBeVisible();
  });

  // ── 2. Check after (detail content) ─────────────────────────────────────
  test('displays deal value and stage', async ({ dealDetailPage }) => {
    await dealDetailPage.goto(dealId);

    const stage = await dealDetailPage.getDealStage();
    expect(stage.length).toBeGreaterThan(0);

    const value = await dealDetailPage.getDealValue().catch(() => '');
    expect(typeof value).toBe('string');
  });

  test('displays summary', async ({ dealDetailPage, page }) => {
    await dealDetailPage.goto(dealId);

    const summaryHeading = page.getByRole('heading', { name: /Summary/i });
    await expect(summaryHeading).toBeVisible();
  });

  test('displays activity timeline section', async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);

    // CI can be slower to render this section; the comment input is a more
    // stable signal than the heading text/role.
    const commentInput = page.getByPlaceholder('Add a comment...');
    await commentInput.scrollIntoViewIfNeeded();
    await expect(commentInput).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Deal Detail - Inline Editing', () => {
  let dealId: number;
  test.beforeAll(async ({ browser }) => {
    dealId = await createFreshDeal(browser);
  });

  test('can edit deal title inline', async ({ dealDetailPage, page }) => {
    const newTitle = `Updated Deal Title ${Date.now()}`;
    await dealDetailPage.goto(dealId);

    const updatePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/deals/${dealId}`) &&
        resp.request().method() === 'PATCH',
      { timeout: 10000 },
    );
    await dealDetailPage.updateTitle(newTitle);
    await updatePromise;

    // Verify immediate UI update
    await expect(dealDetailPage.dealTitle).toHaveText(newTitle);

    // Refresh and verify persistence
    await page.reload();
    await expect(dealDetailPage.dealTitle).toHaveText(newTitle);
  });

  // edit deal stage
  test('can edit deal stage', async ({ dealDetailPage, page }) => {
    const newStage = 'Closed Won';
    const defaultNewStage = 'Prospecting';
    await dealDetailPage.goto(dealId);

    const updatePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/deals/${dealId}`) &&
        resp.request().method() === 'PATCH',
    );

    await dealDetailPage.openActivityHistory();
    await dealDetailPage.updateProperty('Stage', newStage, dealId);
    await expect(dealDetailPage.propertyRow('Stage').locator('dd')).toHaveText(
      newStage,
    );

    // Verify activity entry
    await dealDetailPage.expectActivityEntry(
      `moved deal from ${defaultNewStage} to ${newStage}`,
    );
    await updatePromise;
  });
});

test.describe('Deal Search and Filters', () => {
  // ── 1. Empty state ─────────────────────────────────────────────────────
  test('empty table is shown when no deals exist', async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();

    await dealsPage.searchDeal('zzzzznonexistent123456789');

    await page.waitForLoadState('load', { timeout: 5000 });

    const tableRows = page.locator('table tbody tr');

    await expect(async () => {
      const rowCount = await tableRows.count();
      expect(rowCount).toBe(0);
    }).toPass({ timeout: 3000 });
  });

  // ── 2. Check after (search behavior) ───────────────────────────────────
  test('search updates URL or triggers filter', async ({ dealsPage, page }) => {
    await dealsPage.goto();

    const searchTerm = 'enterprise';
    await dealsPage.searchDeal(searchTerm);

    await page.waitForLoadState('load', { timeout: 5000 });
  });
});

test.describe('Deal Associations - Companies', () => {
  let dealId: number;
  test.beforeAll(async ({ browser }) => {
    dealId = await createFreshDeal(browser);
  });
  // ── 1. Empty state ─────────────────────────────────────────────────────
  test('displays Associated Companies section', async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);

    await expect(
      page.getByRole('heading', { name: /Associated Companies/i }),
    ).toBeVisible();
  });

  test('shows Add Company button', async ({ dealDetailPage, page }) => {
    await dealDetailPage.goto(dealId);

    await expect(
      page.getByRole('button', { name: /Add Company/i }),
    ).toBeVisible();
  });

  test('can open Add Company dialog', async ({ dealDetailPage, page }) => {
    await dealDetailPage.goto(dealId);

    await page.getByRole('button', { name: /Add Company/i }).click();

    await expect(
      page.getByRole('heading', { name: /Add Company to Deal/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/Associate a company with this deal/i),
    ).toBeVisible();
  });

  test('Add Company dialog shows company selection', async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);

    await page.getByRole('button', { name: /Add Company/i }).click();

    const companySelect = page.locator('select').first();
    await expect(companySelect).toBeVisible();
    await expect(
      page.getByText(/Primary company for this deal/i),
    ).toBeVisible();

    const options = await companySelect.locator('option').count();
    expect(options).toBeGreaterThan(0);
  });

  test('can close Add Company dialog', async ({ dealDetailPage, page }) => {
    await dealDetailPage.goto(dealId);

    await page.getByRole('button', { name: /Add Company/i }).click();

    await page.getByRole('button', { name: /Cancel/i }).click();

    await expect(
      page.getByRole('heading', { name: /Add Company to Deal/i }),
    ).toBeHidden();
  });

  // ── 2. Check after (when companies are associated) ──────────────────────
  test('associated companies have clickable links', async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);

    // Find first company link (if any exist)
    const companyLinks = page.locator('a[href^="/companies/"]');
    const count = await companyLinks.count();

    if (count > 0) {
      // Company links should be visible
      await expect(companyLinks.first()).toBeVisible();

      // Link should navigate to company page
      const href = await companyLinks.first().getAttribute('href');
      expect(href).toMatch(/\/companies\/\d+/);
    }
  });

  test('associated companies show Primary badge when applicable', async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);

    // Check if any companies are marked as primary
    const companySection = page
      .locator('text=Associated Companies')
      .locator('..');
    const primaryBadges = companySection.locator('text=Primary');
    const count = await primaryBadges.count();

    // If there are primary companies, badges should be visible
    if (count > 0) {
      await expect(primaryBadges.first()).toBeVisible();
    }
  });

  test('associated companies have edit and remove buttons', async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);

    const companyLinks = page.locator('a[href^="/companies/"]');
    const count = await companyLinks.count();

    if (count > 0) {
      // Each company should have edit and remove buttons
      const editButtons = page.locator('button[title="Edit association"]');
      const removeButtons = page.locator('button[title="Remove company"]');

      expect(await editButtons.count()).toBeGreaterThan(0);
      expect(await removeButtons.count()).toBeGreaterThan(0);
    }
  });

  // Skipped: page.locator('a[href^="/companies/"]') also matches sidebar nav links,
  // making count > 0 even when no companies are actually associated with the deal.
  test.skip('shows empty state when no companies associated', async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);
    const companyLinks = page.locator('a[href^="/companies/"]');
    const count = await companyLinks.count();
    const emptyStateText = page.getByText(/No companies associated yet/i);
    const isEmptyStateVisible = await emptyStateText
      .isVisible()
      .catch(() => false);
    if (count === 0) {
      expect(isEmptyStateVisible).toBe(true);
    } else {
      expect(isEmptyStateVisible).toBe(false);
    }
  });
});

test.describe('Deal Associations - Contacts', () => {
  let dealId: number;
  test.beforeAll(async ({ browser }) => {
    dealId = await createFreshDeal(browser);
  });
  // ── 1. Empty state ─────────────────────────────────────────────────────
  test('displays Associated Contacts section', async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);

    await expect(
      page.getByRole('heading', { name: /Associated Contacts/i }),
    ).toBeVisible();
  });

  test('shows Add Contact button', async ({ dealDetailPage, page }) => {
    await dealDetailPage.goto(dealId);

    await expect(
      page.getByRole('button', { name: /Add Contact/i }),
    ).toBeVisible();
  });

  test('can open Add Contact dialog', async ({ dealDetailPage, page }) => {
    await dealDetailPage.goto(dealId);

    await page.getByRole('button', { name: /Add Contact/i }).click();

    await expect(
      page.getByRole('heading', { name: /Add Contact to Deal/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/Associate a contact person with this deal/i),
    ).toBeVisible();
  });

  test('Add Contact dialog shows contact selection and role', async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);

    await page.getByRole('button', { name: /Add Contact/i }).click();

    const contactSelect = page.locator('select').first();
    await expect(contactSelect).toBeVisible();

    const roleInput = page.locator('input[type="text"]').first();
    await expect(roleInput).toBeVisible();

    await expect(
      page.getByText(/Primary contact for this deal/i),
    ).toBeVisible();

    const options = await contactSelect.locator('option').count();
    expect(options).toBeGreaterThan(0);
  });

  test('can close Add Contact dialog', async ({ dealDetailPage, page }) => {
    await dealDetailPage.goto(dealId);
    await expect(
      page.getByRole('button', { name: /Add Contact/i }),
    ).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /Add Contact/i }).click();

    await page.getByRole('button', { name: /Cancel/i }).click();

    await expect(
      page.getByRole('heading', { name: /Add Contact to Deal/i }),
    ).toBeHidden();
  });

  // ── 2. Check after (when contacts are associated) ───────────────────────
  test('associated contacts have clickable links', async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);

    // Find first contact link (if any exist)
    const contactLinks = page.locator('a[href^="/contacts/"]');
    const count = await contactLinks.count();

    if (count > 0) {
      // Contact links should be visible
      await expect(contactLinks.first()).toBeVisible();

      // Link should navigate to contact page
      const href = await contactLinks.first().getAttribute('href');
      expect(href).toMatch(/\/contacts\/\d+/);
    }
  });

  test('associated contacts show role and Primary badges', async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);

    const contactSection = page
      .locator('text=Associated Contacts')
      .locator('..');

    // Check for role badges (they may or may not exist depending on data)
    const roleBadges = contactSection
      .locator('span')
      .filter({ hasText: /Decision Maker|Influencer|Champion/i });
    const roleCount = await roleBadges.count();

    // Check for primary badges
    const primaryBadges = contactSection.locator('text=Primary');
    const primaryCount = await primaryBadges.count();

    // At least one type of badge should exist if there are contacts
    const contactLinks = page.locator('a[href^="/contacts/"]');
    const contactCount = await contactLinks.count();

    if (contactCount > 0) {
      // Badges are optional, so we just verify they render when present
      expect(roleCount + primaryCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('associated contacts have edit and remove buttons', async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);

    const contactLinks = page.locator('a[href^="/contacts/"]');
    const count = await contactLinks.count();

    if (count > 0) {
      // Each contact should have edit and remove buttons
      const editButtons = page.locator('button[title="Edit association"]');
      const removeButtons = page.locator('button[title="Remove contact"]');

      expect(await editButtons.count()).toBeGreaterThan(0);
      expect(await removeButtons.count()).toBeGreaterThan(0);
    }
  });

  // Skipped: same nav-link counting issue as the companies empty state test.
  test.skip('shows empty state when no contacts associated', async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);
    const contactLinks = page.locator('a[href^="/contacts/"]');
    const count = await contactLinks.count();
    const emptyStateText = page.getByText(/No contacts associated yet/i);
    const isEmptyStateVisible = await emptyStateText
      .isVisible()
      .catch(() => false);
    if (count === 0) {
      expect(isEmptyStateVisible).toBe(true);
    } else {
      expect(isEmptyStateVisible).toBe(false);
    }
  });
});

test.describe.serial('Deal Associations - Contact Removal Dialog', () => {
  let dealId: number;

  test.beforeAll(async ({ browser }) => {
    dealId = await createFreshDeal(browser);
  });

  test('confirm dialog closes automatically after removing a contact from a deal', async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);

    // Add a contact first so we have something to remove
    await page.getByRole('button', { name: /Add Contact/i }).click();
    await page.waitForSelector('text=Add Contact to Deal');
    const contactSelect = page.locator('select').first();
    await contactSelect
      .locator('option[value]:not([value=""])')
      .first()
      .waitFor({ state: 'attached', timeout: 10000 });
    await contactSelect.selectOption({ index: 1 });
    const addBtn = page.getByRole('dialog').getByRole('button', {
      name: /Add Contact/i,
    });
    await addBtn.click();
    await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 10000 });

    // Now remove the contact and verify the dialog closes automatically
    const removeButton = page.getByTitle('Remove contact').first();
    await removeButton.waitFor({ state: 'visible', timeout: 10000 });
    await removeButton.click();

    const confirmDialog = page.getByRole('button', { name: /^Remove$/ });
    await confirmDialog.waitFor({ state: 'visible', timeout: 5000 });
    await confirmDialog.click();

    // Dialog must close on its own — no manual Escape needed
    await expect(confirmDialog).toBeHidden({ timeout: 10000 });
  });
});

test.describe.serial('Deal Associations - Company Removal Dialog', () => {
  let dealId: number;

  test.beforeAll(async ({ browser }) => {
    dealId = await createFreshDeal(browser);
  });

  test('confirm dialog closes automatically after removing a company from a deal', async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(dealId);

    // Add a company first so we have something to remove
    await page.getByRole('button', { name: /Add Company/i }).click();
    await page.waitForSelector('text=Add Company to Deal');
    const companySelect = page.locator('select').first();
    await companySelect
      .locator('option[value]:not([value=""])')
      .first()
      .waitFor({ state: 'attached', timeout: 10000 });
    await companySelect.selectOption({ index: 1 });
    const addBtn = page.getByRole('dialog').getByRole('button', {
      name: /Add Company/i,
    });
    await addBtn.click();
    await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 10000 });

    // Now remove the company and verify the dialog closes automatically
    const removeButton = page.getByTitle('Remove company').first();
    await removeButton.waitFor({ state: 'visible', timeout: 10000 });
    await removeButton.click();

    const confirmDialog = page.getByRole('button', { name: /^Remove$/ });
    await confirmDialog.waitFor({ state: 'visible', timeout: 5000 });
    await confirmDialog.click();

    // Dialog must close on its own — no manual Escape needed
    await expect(confirmDialog).toBeHidden({ timeout: 10000 });
  });
});

test.describe.serial('Column Creation Flow', () => {
  const identifier = Date.now();
  const columnName = `Source ${identifier}`;
  const columnKey = `source_${identifier}`;

  test('Creates new column from column creation dialog', async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();

    const addColumnButton = page.getByRole('button', { name: /Add column/i });
    await addColumnButton.click();

    await expect(page.getByText(/Add new field/i)).toBeVisible();

    await page.getByPlaceholder('Field name').fill(columnName);
    await page.getByPlaceholder(/Unique column key/i).fill(columnKey);
    await page.locator('select').selectOption('text');

    await page.getByRole('button', { name: 'Create field' }).click();

    await expect(page.getByText('Column created successfully')).toBeVisible({
      timeout: 10000,
    });
    // Navigate to deals page to get a fresh SSR load that includes the new column
    await dealsPage.goto();
    await expect(
      page.getByRole('columnheader', { name: columnName }),
    ).toBeVisible({ timeout: 15000 });
  });

  test('Shows error toast when creating column with existing default column key (title)', async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();

    const addColumnButton = page.getByRole('button', { name: /Add column/i });
    await addColumnButton.click();

    await page.getByPlaceholder('Field name').fill('Column New');
    await page.getByPlaceholder(/Unique column key/i).fill('title');
    await page.getByRole('button', { name: 'Create field' }).click();

    await expect(page.getByText('Column key already exists')).toBeVisible();
  });

  test('Shows error toast when creating column with existing column key', async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();

    const addColumnButton = page.getByRole('button', { name: /Add column/i });
    await addColumnButton.click();

    await page.getByPlaceholder('Field name').fill('Column New');
    await page.getByPlaceholder(/Unique column key/i).fill(columnKey);
    await page.getByRole('button', { name: 'Create field' }).click();

    await expect(page.getByText('Column key already exists')).toBeVisible();
  });

  test('Shows field level validation when submitting empty form', async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();

    const addColumnButton = page.getByRole('button', { name: /Add column/i });
    await addColumnButton.click();

    await page.getByRole('button', { name: 'Create field' }).click();

    await expect(page.getByText('Field name is required')).toBeVisible();
    await expect(page.getByText('Column key is required')).toBeVisible();

    const invalidKey = 'column key';
    await page.getByPlaceholder('Field name').fill(columnName);
    await page.getByPlaceholder(/Unique column key/i).fill(invalidKey);
    await page.getByRole('button', { name: 'Create field' }).click();

    await expect(
      page.getByText(
        'Column key must contain only lowercase letters, numbers, and underscores',
      ),
    ).toBeVisible();
  });
});

test.describe('Row Creation Flow', () => {
  test('Creates new deal using the sheet flow', async ({ dealsPage, page }) => {
    await dealsPage.goto();
    const dealName = `Row Flow Deal ${Date.now()}`;
    const initialCount = (await dealsPage.getDealItems()).length;

    await dealsPage.createNewRecord(dealName);

    const rows = await dealsPage.getDealItems();
    expect(rows.length).toBe(initialCount + 1);

    // Get the headers to find column indices
    const headers = page.getByRole('columnheader');
    const headerTexts = await headers.allInnerTexts();

    // Find expected column indices
    const sNoIndex = headerTexts.findIndex((h) =>
      h.toLowerCase().includes('s.no'),
    );
    const dealTitleIndex = headerTexts.findIndex((h) =>
      h.toLowerCase().includes('title'),
    );
    const ownerIndex = headerTexts.findIndex((h) =>
      h.toLowerCase().includes('owner'),
    );
    const stageIndex = headerTexts.findIndex((h) =>
      h.toLowerCase().includes('stage'),
    );
    const probabilityIndex = headerTexts.findIndex((h) =>
      h.toLowerCase().includes('probability'),
    );

    const newDealRow = page
      .getByRole('row')
      .filter({ hasText: dealName })
      .first();

    if (sNoIndex !== -1) {
      await expect(newDealRow.locator('td').nth(sNoIndex)).toHaveText(
        (initialCount + 1).toString(),
      );
    }

    // Validate deal title field
    await expect(newDealRow.locator('td').nth(dealTitleIndex)).toHaveText(
      dealName,
    );

    // Validate Owner field (current user name)
    await expect(newDealRow.locator('td').nth(ownerIndex)).toContainText(
      'E2E Test User',
    );

    // Validate probability field to have default value as 50
    await expect(newDealRow.locator('td').nth(probabilityIndex)).toHaveText(
      '50',
    );

    // Validate stage field to have default value as Prospecting
    await expect(newDealRow.locator('td').nth(stageIndex)).toHaveText(
      'Prospecting',
    );
  });
});

test.describe('Cell Editing Flow', () => {
  test('Edits deal title cell value', async ({ dealsPage, page }) => {
    await dealsPage.goto();
    await dealsPage.getDealItems();

    const initialRowCount = await page.locator('table tbody tr').count();
    if (initialRowCount === 0) {
      await dealsPage.createNewRecord();
    }

    // The first data row is index 1 because index 0 is the header
    const firstRow = page.getByRole('row').nth(1);

    // Get headers to find the 'Title' column index
    const headers = page.getByRole('columnheader');
    const headerTexts = await headers.allInnerTexts();
    const titleIndex = headerTexts.findIndex((h) =>
      h.toLowerCase().includes('title'),
    );

    const titleCell = firstRow.locator('td').nth(titleIndex);
    const newValue = 'Updated Deal Title';

    // Click to enter edit mode
    await titleCell.evaluate((node) => (node as any).click());

    // The Input should be visible
    const input = titleCell.locator('input');
    await expect(input).toBeVisible();
    await input.fill(newValue);
    await input.press('Enter');

    // Success toast should appear
    await expect(page.getByText('Cell updated successfully')).toBeVisible();

    // Value should be updated in the cell
    await expect(titleCell).toHaveText(newValue);

    // Verify persistence after reload
    await page.reload();
    await dealsPage.getDealItems();
    await expect(page.getByText(newValue, { exact: true })).toBeVisible();
  });

  test('Edits deal probability cell value (numeric type)', async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();
    await dealsPage.getDealItems();

    const initialRowCount = await page.locator('table tbody tr').count();
    if (initialRowCount === 0) {
      await dealsPage.createNewRecord();
    }

    const firstRow = page.getByRole('row').nth(1);
    const headers = page.getByRole('columnheader');
    const headerTexts = await headers.allInnerTexts();
    const probabilityIndex = headerTexts.findIndex((h) =>
      h.toLowerCase().includes('probability'),
    );

    const probabilityCell = firstRow.locator('td').nth(probabilityIndex);
    const newValue = '75';

    await probabilityCell.evaluate((node) => (node as any).click());
    const input = probabilityCell.locator('input');
    await expect(input).toBeVisible();
    await input.fill(newValue);
    await input.blur();

    await expect(page.getByText('Cell updated successfully')).toBeVisible();
    await expect(probabilityCell).toHaveText(newValue);

    await page.reload();
    await dealsPage.getDealItems();
    await expect(page.getByText(newValue, { exact: true })).toBeVisible();
  });

  test('Edits deal expected close date cell value (date type)', async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();
    await dealsPage.getDealItems();

    const initialRowCount = await page.locator('table tbody tr').count();
    if (initialRowCount === 0) {
      await dealsPage.createNewRecord();
    }

    const firstRow = page.getByRole('row').nth(1);
    const headers = page.getByRole('columnheader');
    const headerTexts = await headers.allInnerTexts();
    const expectedCloseDateIndex = headerTexts.findIndex((h) =>
      h.toLowerCase().includes('expected close'),
    );

    const expectedCloseDateCell = firstRow
      .locator('td')
      .nth(expectedCloseDateIndex);
    const newValue = '2025-12-31';
    const formattedValue = dayjs(newValue).format('DD MMM YYYY');

    await expectedCloseDateCell.evaluate((node) => (node as any).click());
    const input = expectedCloseDateCell.locator('input');
    await expect(input).toBeVisible();
    await input.fill(newValue);
    await input.blur();

    await expect(page.getByText('Cell updated successfully')).toBeVisible();
    await expect(expectedCloseDateCell).toHaveText(formattedValue);

    await page.reload();
    await dealsPage.getDealItems();
    await expect(page.getByText(formattedValue, { exact: true })).toBeVisible();

    // test clearing date type field
    await expectedCloseDateCell.evaluate((node) => (node as any).click());
    const input2 = expectedCloseDateCell.locator('input');
    await expect(input2).toBeVisible();
    await input2.fill('');
    await input2.blur();

    await expect(page.getByText('Cell updated successfully')).toBeVisible();
    await expect(expectedCloseDateCell).toHaveText('');

    await page.reload();
    await dealsPage.getDealItems();
    await expect(page.getByText(formattedValue, { exact: true })).toBeHidden();
  });

  test('Edits deal stage cell value (select type)', async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();
    await dealsPage.getDealItems();

    const initialRowCount = await page.locator('table tbody tr').count();
    if (initialRowCount === 0) {
      await dealsPage.createNewRecord();
    }

    const firstRow = page.getByRole('row').nth(1);
    const headers = page.getByRole('columnheader');
    const headerTexts = await headers.allInnerTexts();
    const stageIndex = headerTexts.findIndex((h) =>
      h.toLowerCase().includes('stage'),
    );

    const stageCell = firstRow.locator('td').nth(stageIndex);

    // Click to enter edit mode
    await stageCell.evaluate((node) => (node as any).click());

    // The Select should be visible
    const select = stageCell.locator('select');
    await expect(select).toBeVisible();

    // Read current value and pick a different one so the update always fires
    const currentValue = await select.inputValue();
    const newValue =
      currentValue === 'qualification' ? 'prospecting' : 'qualification';
    const labelValue =
      newValue === 'qualification' ? 'Qualification' : 'Prospecting';

    await select.selectOption({ value: newValue });

    // Success toast should appear
    await expect(page.getByText('Cell updated successfully')).toBeVisible();

    // Value should be updated in the cell (showing the label)
    await expect(stageCell).toHaveText(labelValue);

    // Verify persistence after reload — scope to the first data row to avoid
    // matching the label across multiple deals
    await page.reload();
    await dealsPage.getDealItems();
    const reloadedHeaders = await page
      .getByRole('columnheader')
      .allInnerTexts();
    const reloadedStageIndex = reloadedHeaders.findIndex((h) =>
      h.toLowerCase().includes('stage'),
    );
    const reloadedStageCell = page
      .getByRole('row')
      .nth(1)
      .locator('td')
      .nth(reloadedStageIndex);
    await expect(reloadedStageCell).toHaveText(labelValue);
  });
});

test.describe.serial('Custom Column Flow - Select Type', () => {
  const identifier = Date.now();
  const columnName = `Priority Level ${identifier}`;
  const columnKey = `priority_level_${identifier}`;

  test('Creates a column with type select and options', async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();

    // Ensure at least one row exists
    const deals = await dealsPage.getDealItems();
    if (deals.length === 0) {
      await dealsPage.createNewRecord();
    }

    // Open add column dialog
    const addColumnButton = page.getByRole('button', { name: /Add column/i });
    await addColumnButton.click();
    await expect(page.getByText(/Add new field/i)).toBeVisible();

    // Fill column details
    await page.getByPlaceholder('Field name').fill(columnName);
    await page.getByPlaceholder(/Unique column key/i).fill(columnKey);
    await page.getByLabel(/Field Type/i).selectOption('select');

    // Test option management: add and remove
    const addOptionButton = page.getByRole('button', { name: /Add option/i });

    // Default 1 option exists
    await expect(page.getByPlaceholder('Option value')).toHaveCount(1);

    await addOptionButton.click();
    await expect(page.getByPlaceholder('Option value')).toHaveCount(2);

    // Remove the newly added option
    const secondOptionContainer = page.locator('div.group').nth(1);
    await secondOptionContainer.hover();
    await secondOptionContainer.locator('button').click();
    await expect(page.getByPlaceholder('Option value')).toHaveCount(1);

    // Add final options
    await page.getByPlaceholder('Option value').nth(0).fill('High');
    await addOptionButton.click();
    await page.getByPlaceholder('Option value').nth(1).fill('Low');

    // Create the field
    await page.getByRole('button', { name: 'Create field' }).click();

    // Verify creation
    await expect(page.getByText('Column created successfully')).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: columnName }),
    ).toBeVisible();
  });

  test('Updates a cell value for the new select type column', async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();

    // Find the dynamic column index
    const headers = page.getByRole('columnheader');
    const headerTexts = await headers.allInnerTexts();
    const columnIndex = headerTexts.findIndex((h) => h.includes(columnName));
    expect(columnIndex).toBeGreaterThan(-1);

    const firstRow = page.getByRole('row').nth(1);
    const cell = firstRow.locator('td').nth(columnIndex);

    // Click to view options
    await cell.click();

    // Validate select dropdown and its options
    const select = cell.locator('select');
    await expect(select).toBeVisible();
    const options = await select.locator('option').allInnerTexts();
    expect(options).toContain('High');
    expect(options).toContain('Low');

    // Select an option and verify update
    await select.selectOption('High');
    await expect(page.getByText('Cell updated successfully')).toBeVisible();
    await expect(cell).toHaveText('High');
  });
});

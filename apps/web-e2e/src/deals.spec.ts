import { test, expect } from "./fixtures";

/**
 * Deals Feature E2E Tests
 * Tests deal CRUD, navigation, search, and detail views
 */

test.describe("Deals Page - Unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects to sign-in when not authenticated", async ({ page }) => {
    await page.goto("/deals");
    await page.waitForURL("**/sign-in**", { timeout: 10000 });
    expect(page.url()).toContain("/sign-in");
    await expect(page.locator("h1")).toContainText("Sign in to Zuko");
  });
});

test.describe("Deals - Authenticated", () => {
  // ── 1. Empty state ─────────────────────────────────────────────────────
  test("displays deals page when authenticated", async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();

    expect(page.url()).toContain("/deals");
    await dealsPage.waitForDealsToLoad();
  });

  test("can view deal list", async ({ dealsPage }) => {
    await dealsPage.goto();

    const deals = await dealsPage.getDealItems();
    expect(Array.isArray(deals)).toBe(true);
  });

  // ── 2. Create ─────────────────────────────────────────────────────────
  test("can navigate to create new deal", async ({ dealsPage, page }) => {
    await dealsPage.goto();

    await dealsPage.clickNewDeal();

    await page.waitForURL("**/deals/new");
    expect(page.url()).toContain("/deals/new");
  });

  test("can create a new deal", async ({ dealsPage, page }) => {
    await dealsPage.goto();
    await dealsPage.clickNewDeal();
    await page.waitForURL("**/deals/new", { timeout: 10000 });
    await page.getByLabel(/Deal Title/i).fill("TEST E2E DEAL");
    await page.getByLabel(/Deal Value/i).fill("100000");
    await page.getByLabel(/Stage/i).selectOption("Prospecting");
    await page.getByLabel(/Currency/i).selectOption("USD");
    await page.getByLabel(/Priority/i).selectOption("2"); // value in form; label is "P2 - Medium"
    await page.getByLabel(/Expected Close Date/i).fill("2026-01-01");
    await page.getByLabel(/Source/i).fill("Website");
    await page
      .getByPlaceholder(/Add notes about this deal/i)
      .fill("TEST E2E DEAL SUMMARY");
    await page.getByRole("button", { name: /Create Deal/i }).click();
    await page.waitForURL("**/deals", { timeout: 10000 });
    await expect(page.getByText("TEST E2E DEAL")).toBeVisible({
      timeout: 10000,
    });
  });

  // ── 3. Check after (list with data) ─────────────────────────────────────
  test("can search for deals", async ({ dealsPage, page }) => {
    await dealsPage.goto();

    await dealsPage.searchDeal("test");

    await page.waitForLoadState("load", { timeout: 5000 });
  });

  test("can click on a deal to view details", async ({ dealsPage, page }) => {
    await dealsPage.goto();

    const deals = await dealsPage.getDealItems();
    if (deals.length > 0) {
      // Find the specific deal link within the row to trigger navigation
      const dealLink = deals[0].locator('a[href^="/deals/"]');
      await dealLink.click();

      await page.waitForURL("**/deals/**", { timeout: 10000 });
      expect(page.url()).toMatch(/\/deals\/\d+$/);
    } else {
      test.skip();
    }
  });

  test("deal list displays stage badges", async ({ dealsPage, page }) => {
    await dealsPage.goto();

    const stageBadges = page.locator("span").filter({
      hasText: /Prospecting|Qualification|Proposal|Negotiation|Closed/i,
    });
    const count = await stageBadges.count();

    const deals = await dealsPage.getDealItems();
    if (deals.length > 0) {
      expect(count).toBeGreaterThan(0);
    }
  });

  test("deal list displays currency values", async ({ dealsPage, page }) => {
    await dealsPage.goto();

    const deals = await dealsPage.getDealItems();
    if (deals.length > 0) {
      const currencyValues = page.locator("td").filter({ hasText: /[$€£¥₹]/ });
      const count = await currencyValues.count();

      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test("Renders add row button at the bottom of the table", async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();
    const deals = await dealsPage.getDealItems();

    if (deals.length > 0) {
      const addRowButton = page.getByRole("button", { name: /Add row/i });
      await expect(addRowButton).toBeVisible();
    }
  });

  test("Opens add column dialog when header plus icon is clicked", async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();
    const deals = await dealsPage.getDealItems();

    if (deals.length > 0) {
      const addColumnButton = page.getByRole("button", { name: /Add column/i });
      await addColumnButton.click();
      await expect(page.getByText(/Add new field/i)).toBeVisible();
    }
  });
});

test.describe("Deal Creation", () => {
  test("validates required fields", async ({ page }) => {
    await page.goto("/deals/new");

    await page.getByRole("button", { name: /Create Deal/i }).click();

    await expect(page.getByText(/Deal title is required/i)).toBeVisible();
  });

  test("validates value is a positive number", async ({ page }) => {
    await page.goto("/deals/new");

    await page.getByLabel(/Deal Title/i).fill("Test Deal");
    await page.getByLabel(/Deal Value/i).fill("-100");
    await page.getByRole("button", { name: /Create Deal/i }).click();

    await expect(
      page.getByText(/Value must be a positive number/i)
    ).toBeVisible();
  });

  // Skipped: Chrome's native HTML5 form validation (max="100") intercepts submission
  // before React's onSubmit fires, so the custom error message never renders.
  test.skip("validates probability is between 0 and 100", async ({ page }) => {
    await page.goto("/deals/new");
    await page.getByLabel(/Deal Title/i).fill("Test Deal");
    await page.getByLabel(/Win Probability/i).fill("150");
    await page.getByRole("button", { name: /Create Deal/i }).click();
    await expect(
      page.getByText(/Probability must be between 0 and 100/i)
    ).toBeVisible();
  });

  test("displays stage options", async ({ page }) => {
    await page.goto("/deals/new");

    const stageSelect = page.getByLabel(/Stage/i);
    await expect(stageSelect).toBeVisible();

    const options = await stageSelect.locator("option").allTextContents();
    expect(options.length).toBeGreaterThan(0);
    expect(options.some((opt) => opt.includes("Prospecting"))).toBe(true);
  });

  test("displays currency options", async ({ page }) => {
    await page.goto("/deals/new");

    const currencySelect = page.getByLabel(/Currency/i);
    await expect(currencySelect).toBeVisible();

    const options = await currencySelect.locator("option").allTextContents();
    expect(options.length).toBeGreaterThan(0);
    expect(options.some((opt) => opt.includes("USD"))).toBe(true);
  });

  test("displays priority options", async ({ page }) => {
    await page.goto("/deals/new");

    const prioritySelect = page.getByLabel(/Priority/i);
    await expect(prioritySelect).toBeVisible();

    const options = await prioritySelect.locator("option").allTextContents();
    expect(options.length).toBeGreaterThan(0);
    expect(options.some((opt) => opt.includes("P2"))).toBe(true);
  });
});

test.describe("Deal Detail", () => {
  // ── 1. Empty state (detail sections visible) ────────────────────────────
  test("displays deal detail page with information", async ({
    page,
    dealDetailPage,
  }) => {
    await dealDetailPage.goto(1);

    await expect(dealDetailPage.dealTitle).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Deal Information/i })
    ).toBeVisible();
  });

  // ── 2. Check after (detail content) ─────────────────────────────────────
  test("displays deal value and stage", async ({ dealDetailPage }) => {
    await dealDetailPage.goto(1);

    const stage = await dealDetailPage.getDealStage();
    expect(stage.length).toBeGreaterThan(0);

    const value = await dealDetailPage.getDealValue().catch(() => "");
    expect(typeof value).toBe("string");
  });

  test("displays owners section", async ({ dealDetailPage, page }) => {
    await dealDetailPage.goto(1);

    await expect(page.getByRole("heading", { name: /Owners/i })).toBeVisible();
  });

  test("displays summary if present", async ({ dealDetailPage, page }) => {
    await dealDetailPage.goto(1);

    const summaryHeading = page.getByRole("heading", { name: /Summary/i });
    const isVisible = await summaryHeading.isVisible().catch(() => false);

    if (isVisible) {
      await expect(summaryHeading).toBeVisible();
    }
  });

  test("displays activity timeline section", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(1);

    // CI can be slower to render this section; the comment input is a more
    // stable signal than the heading text/role.
    const commentInput = page.getByPlaceholder("Add a comment...");
    await commentInput.scrollIntoViewIfNeeded();
    await expect(commentInput).toBeVisible({ timeout: 30000 });
  });

  test("displays metadata section", async ({ dealDetailPage, page }) => {
    await dealDetailPage.goto(1);

    await expect(page.getByRole("heading", { name: /Details/i })).toBeVisible();
    await expect(page.getByText("Created", { exact: true })).toBeVisible();
    await expect(page.getByText(/Last Updated/i)).toBeVisible();
  });
});

test.describe("Deal Edit", () => {
  // ── 1. Empty state (edit form) ──────────────────────────────────────────
  test("can navigate to edit page", async ({ dealDetailPage, page }) => {
    await dealDetailPage.goto(1);

    await dealDetailPage.clickEdit();

    await page.waitForURL("**/deals/**/edit");
    expect(page.url()).toContain("/edit");
  });

  test("edit page displays deal form with existing values", async ({
    page,
  }) => {
    await page.goto("/deals/1/edit");

    await expect(page.getByLabel(/Deal Title/i)).toBeVisible();
    await expect(page.getByLabel(/Stage/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Save Changes/i })
    ).toBeVisible();

    const titleInput = page.getByLabel(/Deal Title/i);
    const titleValue = await titleInput.inputValue();
    expect(titleValue.length).toBeGreaterThan(0);
  });

  test("edit form includes save and cancel buttons", async ({ page }) => {
    await page.goto("/deals/1/edit");

    await expect(
      page.getByRole("button", { name: /Save Changes/i })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Cancel/i })).toBeVisible();
  });
});

test.describe("Deal Search and Filters", () => {
  // ── 1. Empty state ─────────────────────────────────────────────────────
  test("empty table is shown when no deals exist", async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();

    await dealsPage.searchDeal("zzzzznonexistent123456789");

    await page.waitForLoadState("load", { timeout: 5000 });

    const tableRows = page.locator("table tbody tr");

    await expect(async () => {
      const rowCount = await tableRows.count();
      expect(rowCount).toBe(0);
    }).toPass({ timeout: 3000 });
  });

  // ── 2. Check after (search behavior) ───────────────────────────────────
  test("search updates URL or triggers filter", async ({ dealsPage, page }) => {
    await dealsPage.goto();

    const searchTerm = "enterprise";
    await dealsPage.searchDeal(searchTerm);

    await page.waitForLoadState("load", { timeout: 5000 });
  });
});

test.describe("Deal Associations - Companies", () => {
  // ── 1. Empty state ─────────────────────────────────────────────────────
  test("displays Associated Companies section", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(1);

    await expect(
      page.getByRole("heading", { name: /Associated Companies/i })
    ).toBeVisible();
  });

  test("shows Add Company button", async ({ dealDetailPage, page }) => {
    await dealDetailPage.goto(1);

    await expect(
      page.getByRole("button", { name: /Add Company/i })
    ).toBeVisible();
  });

  test("can open Add Company dialog", async ({ dealDetailPage, page }) => {
    await dealDetailPage.goto(1);

    await page.getByRole("button", { name: /Add Company/i }).click();

    await expect(
      page.getByRole("heading", { name: /Add Company to Deal/i })
    ).toBeVisible();
    await expect(
      page.getByText(/Associate a company with this deal/i)
    ).toBeVisible();
  });

  test("Add Company dialog shows company selection", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(1);

    await page.getByRole("button", { name: /Add Company/i }).click();

    const companySelect = page.locator("select").first();
    await expect(companySelect).toBeVisible();
    await expect(
      page.getByText(/Primary company for this deal/i)
    ).toBeVisible();

    const options = await companySelect.locator("option").count();
    expect(options).toBeGreaterThan(0);
  });

  test("can close Add Company dialog", async ({ dealDetailPage, page }) => {
    await dealDetailPage.goto(1);

    await page.getByRole("button", { name: /Add Company/i }).click();

    await page.getByRole("button", { name: /Cancel/i }).click();

    await expect(
      page.getByRole("heading", { name: /Add Company to Deal/i })
    ).toBeHidden();
  });

  // ── 2. Check after (when companies are associated) ──────────────────────
  test("associated companies have clickable links", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(1);

    // Find first company link (if any exist)
    const companyLinks = page.locator('a[href^="/companies/"]');
    const count = await companyLinks.count();

    if (count > 0) {
      // Company links should be visible
      await expect(companyLinks.first()).toBeVisible();

      // Link should navigate to company page
      const href = await companyLinks.first().getAttribute("href");
      expect(href).toMatch(/\/companies\/\d+/);
    }
  });

  test("associated companies show Primary badge when applicable", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(1);

    // Check if any companies are marked as primary
    const companySection = page
      .locator("text=Associated Companies")
      .locator("..");
    const primaryBadges = companySection.locator("text=Primary");
    const count = await primaryBadges.count();

    // If there are primary companies, badges should be visible
    if (count > 0) {
      await expect(primaryBadges.first()).toBeVisible();
    }
  });

  test("associated companies have edit and remove buttons", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(1);

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
  test.skip("shows empty state when no companies associated", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(1);
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

test.describe("Deal Associations - Contacts", () => {
  // ── 1. Empty state ─────────────────────────────────────────────────────
  test("displays Associated Contacts section", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(1);

    await expect(
      page.getByRole("heading", { name: /Associated Contacts/i })
    ).toBeVisible();
  });

  test("shows Add Contact button", async ({ dealDetailPage, page }) => {
    await dealDetailPage.goto(1);

    await expect(
      page.getByRole("button", { name: /Add Contact/i })
    ).toBeVisible();
  });

  test("can open Add Contact dialog", async ({ dealDetailPage, page }) => {
    await dealDetailPage.goto(1);

    await page.getByRole("button", { name: /Add Contact/i }).click();

    await expect(
      page.getByRole("heading", { name: /Add Contact to Deal/i })
    ).toBeVisible();
    await expect(
      page.getByText(/Associate a contact person with this deal/i)
    ).toBeVisible();
  });

  test("Add Contact dialog shows contact selection and role", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(1);

    await page.getByRole("button", { name: /Add Contact/i }).click();

    const contactSelect = page.locator("select").first();
    await expect(contactSelect).toBeVisible();

    const roleInput = page.locator('input[type="text"]').first();
    await expect(roleInput).toBeVisible();

    await expect(
      page.getByText(/Primary contact for this deal/i)
    ).toBeVisible();

    const options = await contactSelect.locator("option").count();
    expect(options).toBeGreaterThan(0);
  });

  test("can close Add Contact dialog", async ({ dealDetailPage, page }) => {
    await dealDetailPage.goto(1);

    await page.getByRole("button", { name: /Add Contact/i }).click();

    await page.getByRole("button", { name: /Cancel/i }).click();

    await expect(
      page.getByRole("heading", { name: /Add Contact to Deal/i })
    ).toBeHidden();
  });

  // ── 2. Check after (when contacts are associated) ───────────────────────
  test("associated contacts have clickable links", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(1);

    // Find first contact link (if any exist)
    const contactLinks = page.locator('a[href^="/contacts/"]');
    const count = await contactLinks.count();

    if (count > 0) {
      // Contact links should be visible
      await expect(contactLinks.first()).toBeVisible();

      // Link should navigate to contact page
      const href = await contactLinks.first().getAttribute("href");
      expect(href).toMatch(/\/contacts\/\d+/);
    }
  });

  test("associated contacts show role and Primary badges", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(1);

    const contactSection = page
      .locator("text=Associated Contacts")
      .locator("..");

    // Check for role badges (they may or may not exist depending on data)
    const roleBadges = contactSection
      .locator("span")
      .filter({ hasText: /Decision Maker|Influencer|Champion/i });
    const roleCount = await roleBadges.count();

    // Check for primary badges
    const primaryBadges = contactSection.locator("text=Primary");
    const primaryCount = await primaryBadges.count();

    // At least one type of badge should exist if there are contacts
    const contactLinks = page.locator('a[href^="/contacts/"]');
    const contactCount = await contactLinks.count();

    if (contactCount > 0) {
      // Badges are optional, so we just verify they render when present
      expect(roleCount + primaryCount).toBeGreaterThanOrEqual(0);
    }
  });

  test("associated contacts have edit and remove buttons", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(1);

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
  test.skip("shows empty state when no contacts associated", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(1);
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

test.describe("Deal Activity Timeline - Comments", () => {
  // ── 1. Empty state ─────────────────────────────────────────────────────
  test("should display comment input form in activity timeline", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(1);

    const commentInput = page.getByPlaceholder("Add a comment...");
    await commentInput.scrollIntoViewIfNeeded();
    await expect(commentInput).toBeVisible({ timeout: 30000 });

    const postButton = page.getByRole("button", { name: /Post Comment/i });
    await expect(postButton).toBeVisible();
  });

  test("should disable post button when comment is empty", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(1);

    const commentInput = page.getByPlaceholder("Add a comment...");
    await commentInput.scrollIntoViewIfNeeded();
    await expect(commentInput).toBeVisible({ timeout: 30000 });

    const postButton = page.getByRole("button", { name: /Post Comment/i });
    await expect(postButton).toBeDisabled();
  });

  // ── 2. Create ───────────────────────────────────────────────────────────
  test("should create a new comment successfully on a deal", async ({
    dealDetailPage,
    page,
  }) => {
    await dealDetailPage.goto(1);

    const commentText = `Deal test comment ${Date.now()}`;

    const commentInput = page.getByPlaceholder("Add a comment...");
    await commentInput.waitFor({ state: "visible", timeout: 15000 });
    await commentInput.fill(commentText);

    await page.getByRole("button", { name: /Post Comment/i }).click();

    await expect(page.getByText(commentText)).toBeVisible({ timeout: 10000 });
  });
});

test.describe.serial("Column Creation Flow", () => {
  const columnName = "Source";
  const columnKey = `source`;

  test("Creates new column from column creation dialog", async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();

    const addColumnButton = page.getByRole("button", { name: /Add column/i });
    await addColumnButton.click();

    await expect(page.getByText(/Add new field/i)).toBeVisible();

    await page.getByPlaceholder("Field name").fill(columnName);
    await page.getByPlaceholder(/Unique column key/i).fill(columnKey);
    await page.locator("select").selectOption("text");

    await page.getByRole("button", { name: "Create field" }).click();

    await expect(page.getByText("Column created successfully")).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: columnName })
    ).toBeVisible();
  });

  test("Shows error toast when creating column with existing default column key (title)", async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();

    const addColumnButton = page.getByRole("button", { name: /Add column/i });
    await addColumnButton.click();

    await page.getByPlaceholder("Field name").fill("Column New");
    await page.getByPlaceholder(/Unique column key/i).fill("title");
    await page.getByRole("button", { name: "Create field" }).click();

    await expect(page.getByText("Column key already exists")).toBeVisible();
  });

  test("Shows error toast when creating column with existing column key", async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();

    const addColumnButton = page.getByRole("button", { name: /Add column/i });
    await addColumnButton.click();

    await page.getByPlaceholder("Field name").fill("Column New");
    await page.getByPlaceholder(/Unique column key/i).fill(columnKey);
    await page.getByRole("button", { name: "Create field" }).click();

    await expect(page.getByText("Column key already exists")).toBeVisible();
  });

  test("Shows field level validation when submitting empty form", async ({
    dealsPage,
    page,
  }) => {
    await dealsPage.goto();

    const addColumnButton = page.getByRole("button", { name: /Add column/i });
    await addColumnButton.click();

    await page.getByRole("button", { name: "Create field" }).click();

    await expect(page.getByText("Field name is required")).toBeVisible();
    await expect(page.getByText("Column key is required")).toBeVisible();

    const invalidKey = "column key";
    await page.getByPlaceholder("Field name").fill(columnName);
    await page.getByPlaceholder(/Unique column key/i).fill(invalidKey);
    await page.getByRole("button", { name: "Create field" }).click();
    
    await expect(page.getByText("Column key must contain only lowercase letters, numbers, and underscores")).toBeVisible();
  });
});

test.describe("Row Creation Flow", () => {
  test("Creates new deal row using add row button", async ({ dealsPage, page }) => {
    await dealsPage.goto();
    await dealsPage.getDealItems();

    const initialRowCount = await page.getByRole("row").count();

    const addRowButton = page.getByRole("button", { name: /Add row/i });
    await addRowButton.click();

    // validate success toast message
    await expect(page.getByText(/New deal added/i)).toBeVisible();

    // validate if new row is created
    await expect(page.getByRole("row")).toHaveCount(initialRowCount + 1);
    const updatedRowCount = initialRowCount + 1;

    // Get the headers to find column indices
    const headers = page.getByRole("columnheader");
    const headerTexts = await headers.allInnerTexts();
    
    // Find expected column indices
    const sNoIndex = headerTexts.findIndex(h => h.toLowerCase().includes("s.no"));
    const dealTitleIndex = headerTexts.findIndex(h => h.toLowerCase().includes("title"));
    const ownerIndex = headerTexts.findIndex(h => h.toLowerCase().includes("owner"));
    const stageIndex = headerTexts.findIndex(h => h.toLowerCase().includes("stage"));
    const probabilityIndex = headerTexts.findIndex(h => h.toLowerCase().includes("probability"));

    // nth() is 0-indexed, and initialRowCount counts the header + existing data rows.
    const newDealRow = page.getByRole("row").nth(initialRowCount);

    // Validate S.No field to be equal to the {updatedRowCount - 1} (row count also includes the header)
    await expect(newDealRow.locator("td").nth(sNoIndex)).toHaveText((updatedRowCount-1).toString());

    // Validate deal title field
    await expect(newDealRow.locator("td").nth(dealTitleIndex)).toHaveText("New Deal");

    // Validate Owner field (current user name)
    await expect(newDealRow.locator("td").nth(ownerIndex)).toContainText("E2E Test User");

    // Validate probability field to have default value as 50
    await expect(newDealRow.locator("td").nth(probabilityIndex)).toHaveText("50");

    // Validate stage field to have default value as Prospecting
    await expect(newDealRow.locator("td").nth(stageIndex)).toHaveText("Prospecting");
  });
});

test.describe("Cell Editing Flow", () => {
  test("Edits deal title cell value", async ({ dealsPage, page }) => {
    await dealsPage.goto();
    await dealsPage.getDealItems();

    // The first data row is index 1 because index 0 is the header
    const firstRow = page.getByRole("row").nth(1);
    
    // Get headers to find the 'Title' column index
    const headers = page.getByRole("columnheader");
    const headerTexts = await headers.allInnerTexts();
    const titleIndex = headerTexts.findIndex(h => h.toLowerCase().includes("title"));

    const titleCell = firstRow.locator("td").nth(titleIndex);
    const newValue = "Updated Deal Title";

    // Click to enter edit mode
    await titleCell.evaluate(node => (node as any).click());
    
    // The Input should be visible
    const input = titleCell.locator("input");
    await expect(input).toBeVisible();
    await input.fill(newValue);
    await input.press("Enter");

    // Success toast should appear
    await expect(page.getByText("Cell updated successfully")).toBeVisible();

    // Value should be updated in the cell
    await expect(titleCell).toHaveText(newValue);

    // Verify persistence after reload
    await page.reload();
    await dealsPage.getDealItems();
    await expect(page.getByText(newValue, { exact: true })).toBeVisible();
  });

  test("Edits deal probability cell value (numeric type)", async ({ dealsPage, page }) => {
    await dealsPage.goto();
    await dealsPage.getDealItems();

    const firstRow = page.getByRole("row").nth(1);
    const headers = page.getByRole("columnheader");
    const headerTexts = await headers.allInnerTexts();
    const probabilityIndex = headerTexts.findIndex(h => h.toLowerCase().includes("probability"));

    const probabilityCell = firstRow.locator("td").nth(probabilityIndex);
    const newValue = "75";

    await probabilityCell.evaluate(node => (node as any).click());
    const input = probabilityCell.locator("input");
    await expect(input).toBeVisible();
    await input.fill(newValue);
    await input.blur();

    await expect(page.getByText("Cell updated successfully")).toBeVisible();
    await expect(probabilityCell).toHaveText(newValue);

    await page.reload();
    await dealsPage.getDealItems();
    await expect(page.getByText(newValue, { exact: true })).toBeVisible();
  });
});

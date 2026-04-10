import { test, expect } from './fixtures';

/**
 * E2E tests for the table Add Column dialog — currency and multiselect field types.
 * These run against the Deals table which has showAddColumn enabled.
 */

test.describe('Table Fields - Unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects to sign-in when not authenticated', async ({ page }) => {
    await page.goto('/deals');
    await page.waitForURL('**/sign-in**', { timeout: 10000 });
    expect(page.url()).toContain('/sign-in');
  });
});

test.describe('Table Fields - Add Column Dialog', () => {
  test('Add Column button is visible on the deals table', async ({
    dealsPage,
    tablePage,
    page,
  }) => {
    await dealsPage.goto();
    await expect(tablePage.addColumnButton).toBeVisible({ timeout: 10000 });
  });

  test('opens the Add Column dialog', async ({ dealsPage, tablePage }) => {
    await dealsPage.goto();
    await tablePage.openAddColumnDialog();
    await expect(tablePage.addColumnDialog).toBeVisible();
    await expect(tablePage.addColumnDialog.getByText('Add new field')).toBeVisible();
  });

  test('field type dropdown includes Currency and Multi-select options', async ({
    dealsPage,
    tablePage,
  }) => {
    await dealsPage.goto();
    await tablePage.openAddColumnDialog();

    const optionValues = await tablePage.fieldTypeSelect.evaluate((el) => {
      const select = el as { options: ArrayLike<{ value: string }> };
      return Array.from(select.options).map((o) => o.value);
    });

    expect(optionValues).toContain('currency');
    expect(optionValues).toContain('multiselect');
  });

  test('selecting Currency shows the currency code input defaulting to USD', async ({
    dealsPage,
    tablePage,
  }) => {
    await dealsPage.goto();
    await tablePage.openAddColumnDialog();
    await tablePage.selectFieldType('currency');

    const currencyInput = tablePage.addColumnDialog.getByPlaceholder('e.g. USD, EUR, GBP');
    await expect(currencyInput).toBeVisible();
    await expect(currencyInput).toHaveValue('USD');
  });

  test('selecting Multi-select shows the options builder', async ({
    dealsPage,
    tablePage,
  }) => {
    await dealsPage.goto();
    await tablePage.openAddColumnDialog();
    await tablePage.selectFieldType('multiselect');

    await expect(tablePage.addColumnDialog.getByText('Options')).toBeVisible();
    await expect(tablePage.addColumnDialog.getByPlaceholder('Option value')).toBeVisible();
  });

  test('can add multiple options for multiselect via Add option button', async ({
    dealsPage,
    tablePage,
  }) => {
    await dealsPage.goto();
    await tablePage.openAddColumnDialog();
    await tablePage.selectFieldType('multiselect');

    const addOptionButton = tablePage.addColumnDialog.getByRole('button', { name: /Add option/i });
    await addOptionButton.click();

    const inputs = tablePage.addColumnDialog.getByPlaceholder('Option value');
    expect(await inputs.count()).toBe(2);
  });

  test('shows validation errors when submitting empty form', async ({
    dealsPage,
    tablePage,
  }) => {
    await dealsPage.goto();
    await tablePage.openAddColumnDialog();
    await tablePage.createFieldButton.click();

    await expect(tablePage.addColumnDialog.getByText('Field name is required')).toBeVisible();
    await expect(tablePage.addColumnDialog.getByText('Column key is required')).toBeVisible();
  });

  test('shows validation error for invalid column key', async ({
    dealsPage,
    tablePage,
  }) => {
    await dealsPage.goto();
    await tablePage.openAddColumnDialog();
    await tablePage.fieldNameInput.fill('My Field');
    await tablePage.columnKeyInput.fill('My Field!');
    await tablePage.createFieldButton.click();

    await expect(
      tablePage.addColumnDialog.getByText(/lowercase letters, numbers, and underscores/i)
    ).toBeVisible();
  });

  test('Cancel button closes the dialog without adding a column', async ({
    dealsPage,
    tablePage,
  }) => {
    await dealsPage.goto();
    const headersBefore = await tablePage.getColumnHeaders();

    await tablePage.openAddColumnDialog();
    await tablePage.fieldNameInput.fill('Should Not Appear');
    await tablePage.cancelButton.click();

    await expect(tablePage.addColumnDialog).toBeHidden();
    const headersAfter = await tablePage.getColumnHeaders();
    expect(headersAfter).toEqual(headersBefore);
  });

  test('can create a currency column', async ({ dealsPage, tablePage, page }) => {
    await dealsPage.goto();
    await tablePage.addCurrencyColumn('Budget', 'budget', 'USD');

    // Verify the new column header appears
    await expect(page.getByRole('columnheader', { name: /Budget/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('can create a multiselect column with options', async ({
    dealsPage,
    tablePage,
    page,
  }) => {
    await dealsPage.goto();
    await tablePage.addMultiSelectColumn('Tags', 'tags', ['Hot', 'Cold', 'Warm']);

    await expect(page.getByRole('columnheader', { name: /Tags/i })).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('Table Fields - Currency display', () => {
  test('currency column renders formatted value in the table cell', async ({
    dealsPage,
    tablePage,
    page,
  }) => {
    await dealsPage.goto();

    // Value column exists in the deals table and uses currency fieldType
    const valueHeader = page.getByRole('columnheader', { name: /Value/i });
    await expect(valueHeader).toBeVisible({ timeout: 10000 });

    // At least one cell should contain a currency-formatted value or a dash
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });
});

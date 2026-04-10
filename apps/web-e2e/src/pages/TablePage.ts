import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for the shared table UI — add column dialog,
 * inline cell editing, currency and multiselect fields.
 */
export class TablePage extends BasePage {
  readonly addColumnButton: Locator;
  /** Scoped to visible dialog content — use this instead of getByRole('dialog') */
  readonly addColumnDialog: Locator;
  readonly fieldNameInput: Locator;
  readonly columnKeyInput: Locator;
  readonly fieldTypeSelect: Locator;
  readonly createFieldButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);
    this.addColumnButton = page.getByRole('button', { name: /Add column/i });
    // Headless UI Dialog is in the DOM but CSS-hidden during transitions;
    // scope to the visible title text so Playwright can reliably detect open state.
    this.addColumnDialog = page.locator('[role="dialog"]');
    this.fieldNameInput = page.getByPlaceholder('Field name');
    this.columnKeyInput = page.getByPlaceholder(/Unique column key/i);
    this.fieldTypeSelect = this.addColumnDialog.getByRole('combobox').first();
    this.createFieldButton = page.getByRole('button', { name: /Create field/i });
    this.cancelButton = page.getByRole('button', { name: /Cancel/i });
  }

  async openAddColumnDialog() {
    await this.addColumnButton.click();
    // Wait for visible content inside the dialog rather than the dialog element
    // itself — Headless UI keeps the dialog in the DOM during CSS transitions,
    // which makes Playwright's role-based visibility check unreliable.
    await this.page.getByText('Add new field').waitFor({ state: 'visible', timeout: 10000 });
  }

  async fillColumnDetails(name: string, key: string) {
    await this.fieldNameInput.fill(name);
    await this.columnKeyInput.fill(key);
  }

  async selectFieldType(type: string) {
    await this.fieldTypeSelect.selectOption(type);
  }

  async addCurrencyColumn(name: string, key: string, currencyCode = 'USD') {
    await this.openAddColumnDialog();
    await this.fillColumnDetails(name, key);
    await this.selectFieldType('currency');

    const currencyInput = this.addColumnDialog.getByPlaceholder('e.g. USD, EUR, GBP');
    await currencyInput.clear();
    await currencyInput.fill(currencyCode);

    await this.createFieldButton.click();
    await this.page.getByText('Add new field').waitFor({ state: 'hidden', timeout: 10000 });
  }

  async addMultiSelectColumn(name: string, key: string, options: string[]) {
    await this.openAddColumnDialog();
    await this.fillColumnDetails(name, key);
    await this.selectFieldType('multiselect');

    for (let i = 0; i < options.length; i++) {
      if (i > 0) {
        await this.addColumnDialog.getByRole('button', { name: /Add option/i }).click();
      }
      const inputs = this.addColumnDialog.getByPlaceholder('Option value');
      await inputs.nth(i).fill(options[i]);
    }

    await this.createFieldButton.click();
    await this.page.getByText('Add new field').waitFor({ state: 'hidden', timeout: 10000 });
  }

  async getColumnHeaders(): Promise<string[]> {
    const headers = this.page.locator('table thead th');
    return headers.allTextContents();
  }

  async clickCell(rowIndex: number, columnHeader: string): Promise<Locator> {
    const headers = this.page.locator('table thead th');
    const headerTexts = await headers.allTextContents();
    const colIndex = headerTexts.findIndex((h) => h.trim().includes(columnHeader));
    if (colIndex === -1) throw new Error(`Column "${columnHeader}" not found`);

    const cell = this.page
      .locator('table tbody tr')
      .nth(rowIndex)
      .locator('td')
      .nth(colIndex);

    await cell.click();
    return cell;
  }
}

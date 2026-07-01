import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object Model
 * Contains common functionality shared across all pages
 */
export class BasePage {
  constructor(protected page: Page) {}

  /**
   * Navigate to a specific path
   */
  async goto(path: string) {
    await this.page.goto(path);
  }

  /**
   * Get the current URL
   */
  url(): string {
    return this.page.url();
  }

  /**
   * Wait for a specific URL pattern
   */
  async waitForUrl(
    urlPattern: string | RegExp,
    options?: { timeout?: number },
  ) {
    await this.page.waitForURL(urlPattern, options);
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return this.page.title();
  }

  /**
   * Show history in the activity timeline if it exists and is hidden
   */
  async showHistory() {
    const showBtn = this.page.getByRole('button', { name: /SHOW HISTORY/i });
    if (await showBtn.isVisible()) {
      await showBtn.click();
      await this.page
        .locator('[data-testid="activity-item"]')
        .or(this.page.getByText('No activity yet'))
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
    }
  }

  /**
   * Update the page title (h1) via inline editing.
   * Uses keyboard simulation (select-all + type) so React's synthetic events
   * fire correctly on the contentEditable element, triggering the autosave hook.
   */
  async updateTitle(newTitle: string) {
    const heading = this.page.locator('h1[contenteditable="true"]');
    await heading.click();
    await this.page.keyboard.press('ControlOrMeta+a');
    await heading.pressSequentially(newTitle);
    await heading.blur();
    // Let the 2 s autosave debounce start before the caller awaits the PATCH
    await this.page.waitForTimeout(500);
  }

  /**
   * Take a screenshot
   */
  async screenshot(options?: { path?: string; fullPage?: boolean }) {
    return this.page.screenshot(options);
  }

  /**
   create new record by clicking add row button
   */
  async createNewRecord() {
    await this.page.getByRole('button', { name: /Add row/i }).click();
  }

  async getRowCount() {
    return this.page.getByRole('row').count();
  }

  async getColumnIndex(columnName: string) {
    // Wait for the target header to be visible before reading positions.
    // After a cell update, invalidateQueries causes a re-fetch during which
    // metadata resets to [] and column headers temporarily disappear.
    await this.page
      .getByRole('columnheader', { name: new RegExp(columnName, 'i') })
      .first()
      .waitFor({ state: 'visible', timeout: 10000 });

    const headers = this.page.getByRole('columnheader');
    const headerTexts = await headers.allInnerTexts();
    const columnIndex = headerTexts.findIndex((h) =>
      h.toLowerCase().includes(columnName.toLowerCase()),
    );
    return columnIndex;
  }

  /**
   * Update a cell in the table by column name.
   * Handles both text inputs and comboboxes.
   */
  async updateTableCell(row: Locator, columnHeader: string, value: string) {
    const colIndex = await this.getColumnIndex(columnHeader);
    if (colIndex === -1) throw new Error(`Column "${columnHeader}" not found`);

    const cell = row.locator('td').nth(colIndex);
    // force: true bypasses the "obscured" actionability check while still
    // dispatching real pointer/mouse events that React's onClick can handle.
    // evaluate(.click()) used native DOM click which bypasses React's synthetic
    // event system, so setIsEditing() never fired and no input appeared.
    await cell.click({ force: true });

    // Check if it's a combobox or a simple input
    const combobox = cell.getByRole('combobox');
    const input = cell.locator('input');

    if (await combobox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await combobox.click();
      await this.page
        .getByRole('option', { name: new RegExp(value, 'i') })
        .click();
    } else {
      await input.waitFor({ state: 'visible' });
      await input.fill(value);
      // Date and number inputs save on blur; text inputs save on Enter
      const inputType =
        (await input.getAttribute('type').catch(() => 'text')) ?? 'text';
      if (inputType === 'date' || inputType === 'number') {
        // The cell re-renders immediately after fill, detaching the input from
        // the DOM before blur() can act on it. Pressing Tab at the page level
        // commits the value without requiring the input to remain attached.
        await this.page.keyboard.press('Tab');
      } else {
        await input.press('Enter');
      }
    }
  }

  // ── Inline editing helpers (EntityProperties) ──────────────────────────────

  /**
   * Get the EntityProperties container (the <dl> that holds all properties).
   */
  get propertiesSection() {
    return this.page.locator('dl');
  }

  /**
   * Locate a property row (dt/dd pair) by its label text.
   */
  propertyRow(label: string) {
    return this.propertiesSection.locator('div').filter({
      has: this.page.locator('dt', {
        hasText: new RegExp(`^${label}$`, 'i'),
      }),
    });
  }

  /**
   * Hover the property value to reveal the pencil icon, click it to enter
   * edit mode, and return the input that appears.
   */
  async openPropertyEditor(label: string): Promise<Locator> {
    const row = this.propertyRow(label);
    const dd = row.locator('dd');

    // if dd has '-' as value then click it instead of hover
    if ((await dd.textContent())?.trim() === '—') {
      // find the text inside dd and click it
      const text = dd.locator('text=—');
      await text.click();
    } else {
      // Hover to reveal the pencil icon
      await dd.hover();
      const pencilButton = dd.locator('button[title="Edit"]');
      await expect(pencilButton).toBeVisible({ timeout: 3000 });
      await pencilButton.click();
    }

    const input = dd.locator('input');
    await expect(input).toBeVisible({ timeout: 3000 });
    return input;
  }

  /**
   * Update an EntityProperties text field inline and wait for the PATCH response.
   * Handles both plain inputs and combobox fields (which need an option click).
   * @param entityPath  The API path fragment to match (e.g. "/companies/123")
   */
  async updateEntityProperty(label: string, value: string, entityPath: string) {
    const input = await this.openPropertyEditor(label);

    const patchPromise = this.page.waitForResponse(
      (resp) =>
        resp.url().includes(entityPath) && resp.request().method() === 'PATCH',
      { timeout: 15000 },
    );

    await input.fill(value);

    // For combobox fields (Headless UI), fill filters the list and we must click
    // the matching option. For plain inputs, pressing Enter submits.
    const option = this.page
      .getByRole('option', { name: value, exact: true })
      .first();
    const isCombobox = await option
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (isCombobox) {
      await option.click();
    } else {
      await input.press('Enter');
    }

    await patchPromise;
  }

  /**
   * Read the currently displayed value of an EntityProperties field.
   */
  async getPropertyValue(label: string): Promise<string> {
    const row = this.propertyRow(label);
    const dd = row.locator('dd');
    return ((await dd.textContent()) ?? '').trim();
  }

  /**
   * Get the anchor element (<a>) inside a property's value cell.
   */
  getPropertyLink(label: string): Locator {
    const row = this.propertyRow(label);
    return row.locator('dd a');
  }

  // ── Activity Timeline Helpers ─────────────────────────────────────────────

  /**
   * Scroll to the Activity section & open the history accordion.
   */
  async openActivityHistory() {
    await this.page
      .getByRole('heading', { name: 'Activity', exact: true })
      .scrollIntoViewIfNeeded();
    await this.showHistory();
  }

  /**
   * Assert that a specific activity text is visible in the timeline.
   */
  async expectActivityEntry(textPattern: RegExp | string) {
    let pattern: RegExp;
    if (typeof textPattern === 'string') {
      // Escape special characters so that strings like "+123" match
      const escaped = textPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = new RegExp(escaped, 'i');
    } else {
      pattern = textPattern;
    }

    await expect(
      this.page
        .locator('[data-testid="activity-item"]')
        .filter({ hasText: pattern })
        .first(),
    ).toBeVisible({ timeout: 10000 });
  }
}

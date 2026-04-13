import { Page } from '@playwright/test';

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
    const showBtn = this.page.getByRole("button", { name: /SHOW HISTORY/i });
    if (await showBtn.isVisible()) {
      await showBtn.click();
      // Wait for history to animate in
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Update the page title (h1) via inline editing
   */
  async updateTitle(newTitle: string) {
    const heading = this.page.locator('h1[contenteditable="true"]');
    await heading.fill(newTitle);
    await heading.blur();
    await this.page.waitForTimeout(500);
  }

  /**
   * Take a screenshot
   */
  async screenshot(options?: { path?: string; fullPage?: boolean }) {
    return this.page.screenshot(options);
  }
}

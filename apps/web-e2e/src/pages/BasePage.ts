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
   * Take a screenshot
   */
  async screenshot(options?: { path?: string; fullPage?: boolean }) {
    return this.page.screenshot(options);
  }
}

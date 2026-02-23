import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for Sign In page
 */
export class SignInPage extends BasePage {
  // Locators
  readonly heading: Locator;
  readonly githubSignInButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator('h1');
    this.githubSignInButton = page.getByRole('button', { name: /continue with github/i });
  }

  /**
   * Navigate to the sign-in page
   */
  async goto() {
    await super.goto('/sign-in');
  }

  /**
   * Verify the sign-in page is displayed correctly
   */
  async verifyPageLoaded() {
    await expect(this.heading).toContainText('Sign in to Zuko');
    await expect(this.githubSignInButton).toBeVisible();
  }

  /**
   * Click the GitHub sign-in button
   */
  async clickGitHubSignIn() {
    await this.githubSignInButton.click();
  }

  /**
   * Verify GitHub icon is present on the button
   */
  async verifyGitHubIcon() {
    const svg = this.githubSignInButton.locator('svg');
    await expect(svg).toBeVisible();
  }
}

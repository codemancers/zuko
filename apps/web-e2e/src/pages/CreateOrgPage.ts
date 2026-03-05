import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for Create Organization page
 */
export class CreateOrgPage extends BasePage {
  readonly nameInput: Locator;
  readonly slugInput: Locator;
  readonly saveButton: Locator;
  readonly resetButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.nameInput = page.getByLabel(/organization name/i);
    this.slugInput = page.getByLabel(/organization slug/i);
    this.saveButton = page.getByRole('button', { name: /save changes/i });
    this.resetButton = page.getByRole('button', { name: /reset/i });
    this.errorMessage = page.locator('p.text-red-500, p.text-red-600');
  }

  /**
   * Navigate to the create organization page
   */
  override async goto() {
    await super.goto('/organization/create');
  }

  /**
   * Create a new organization
   */
  async createOrganization(name: string, slug?: string) {
    await this.nameInput.fill(name);
    if (slug) {
      await this.slugInput.fill(slug);
    }
    await this.saveButton.click();
  }
}

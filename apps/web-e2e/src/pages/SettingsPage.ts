import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for Settings page
 */
export class SettingsPage extends BasePage {
  readonly connectGitHubButton: Locator;
  readonly settingsForm: Locator;

  constructor(page: Page) {
    super(page);
    // These selectors might need adjustment based on actual implementation
    this.connectGitHubButton = page.getByRole('button', { name: /connect|github/i });
    this.settingsForm = page.locator('form').or(page.locator('main'));
  }

  /**
   * Navigate to the settings page
   */
  async goto() {
    await super.goto('/settings');
  }

  /**
   * Click connect GitHub button
   */
  async clickConnectGitHub() {
    await this.connectGitHubButton.click();
  }

  /**
   * Save settings
   */
  async saveSettings() {
    const saveButton = this.page.getByRole('button', { name: /save/i });
    await saveButton.click();
  }

  /**
   * Get setting value by label
   */
  async getSettingValue(label: string): Promise<string> {
    const input = this.page.getByLabel(label);
    return input.inputValue();
  }

  /**
   * Update setting by label
   */
  async updateSetting(label: string, value: string) {
    const input = this.page.getByLabel(label);
    await input.fill(value);
  }
}

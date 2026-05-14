import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for Settings page
 */
export class SettingsPage extends BasePage {
  readonly connectGoogleButton: Locator;
  readonly settingsForm: Locator;
  readonly membersTab: Locator;
  readonly teamsTab: Locator;
  readonly invitationsTab: Locator;
  readonly createTeamButton: Locator;
  readonly inviteToOrgButton: Locator;
  readonly addMemberEmailInput: Locator;
  readonly addMemberRoleCombobox: Locator;
  readonly sendInvitationButton: Locator;
  readonly addToTeamButton: Locator;
  readonly selectMemberCombobox: Locator;
  readonly selectTeamCombobox: Locator;
  readonly confirmAddToTeamButton: Locator;

  constructor(page: Page) {
    super(page);
    this.connectGoogleButton = page.getByRole('button', {
      name: /connect|google/i,
    });
    this.settingsForm = page.locator('form').or(page.locator('main'));
    this.membersTab = page.getByRole('tab', { name: /members/i });
    this.teamsTab = page.getByRole('tab', { name: /teams/i });
    this.invitationsTab = page.getByRole('tab', { name: /invitations/i });
    this.createTeamButton = page.getByRole('button', { name: /create team/i });
    this.inviteToOrgButton = page.getByRole('button', {
      name: /invite to org/i,
    });
    this.addMemberEmailInput = page.getByLabel(/email address/i);
    this.addMemberRoleCombobox = page.getByRole('combobox', { name: /role/i });
    this.sendInvitationButton = page.getByRole('button', {
      name: /send invitation/i,
    });
    this.addToTeamButton = page.getByRole('button', { name: /add to team/i });
    this.selectMemberCombobox = page.getByRole('combobox', { name: /member/i });
    this.selectTeamCombobox = page.getByRole('combobox', { name: /team/i });
    this.confirmAddToTeamButton = page.getByRole('button', {
      name: /add to team/i,
    });
  }

  /**
   * Navigate to the settings page
   */
  override async goto() {
    await super.goto('/settings');
  }

  async switchTab(tab: 'members' | 'teams' | 'invitations' | 'connections') {
    const tabLocator = this.page.getByRole('tab', {
      name: new RegExp(tab, 'i'),
    });
    await tabLocator.click();
  }

  async inviteMember(email: string, role = 'Member') {
    // Members are invited via "Add row" + inline email input + Enter
    const addRowButton = this.page.getByRole('button', { name: /add row/i });
    await addRowButton.click();
    const emailInput = this.page.getByPlaceholder(/email.*enter to invite/i);
    await emailInput.waitFor({ state: 'visible', timeout: 5000 });
    await emailInput.fill(email);
    // Select role if provided via the inline Select
    if (role !== 'Member') {
      const roleSelect = this.page.locator('tr').last().locator('select');
      await roleSelect.selectOption({ label: role });
    }
    await emailInput.press('Enter');
  }

  async acceptInvitation() {
    await this.switchTab('invitations');
    await this.page
      .getByRole('button', { name: /accept invitation/i })
      .first()
      .click();
  }

  /**
   * Click connect Google button
   */
  async clickConnectGoogle() {
    await this.connectGoogleButton.click();
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

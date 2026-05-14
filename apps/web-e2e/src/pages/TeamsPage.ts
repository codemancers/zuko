import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class TeamsPage extends BasePage {
  readonly createTeamButton: Locator;
  readonly newTeamButton: Locator;
  readonly teamNameInput: Locator;
  readonly submitButton: Locator;
  readonly teamList: Locator;

  constructor(page: Page) {
    super(page);
    this.createTeamButton = page.getByRole('button', { name: /create team/i });
    this.newTeamButton = page.getByRole('button', { name: /new team/i });
    this.teamNameInput = page.getByLabel(/team name/i);
    this.submitButton = page.getByRole('button', { name: /^create team$/i });
    this.teamList = page.locator('ul.mt-10'); // Based on org-teams.tsx
  }

  override async goto(slug: string) {
    await this.page.goto(`/organization/${slug}/teams`);
  }

  async createTeam(name?: string) {
    const createBtn = this.createTeamButton;
    const newBtn = this.newTeamButton;

    // Wait for either button to be visible
    await expect(createBtn.or(newBtn)).toBeVisible({ timeout: 10000 });

    if (await createBtn.isVisible()) {
      await createBtn.click();
    } else {
      await newBtn.click();
    }
    await this.teamNameInput.waitFor({ state: 'visible', timeout: 5000 });
    await this.teamNameInput.fill(name ?? `New Team ${Date.now()}`);
    await this.submitButton.click();
  }
}

import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class TeamsPage extends BasePage {
  readonly createTeamButton: Locator;
  readonly teamNameInput: Locator;
  readonly submitButton: Locator;
  readonly teamList: Locator;

  constructor(page: Page) {
    super(page);
    this.createTeamButton = page.getByRole('button', { name: /create team/i });
    this.teamNameInput = page.getByLabel(/team name/i);
    this.submitButton = page.getByRole('button', { name: /^create team$/i });
    this.teamList = page.locator('ul.mt-10'); // Based on org-teams.tsx
  }

  async goto(slug: string) {
    await this.page.goto(`/organization/${slug}/teams`);
  }

  async createTeam(name: string) {
    await this.createTeamButton.click();
    await this.teamNameInput.fill(name);
    await this.submitButton.click();
  }
}

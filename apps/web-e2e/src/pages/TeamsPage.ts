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

  override async goto(slug: string) {
    await this.page.goto(`/organization/${slug}/teams`);
  }

  async createTeam(name?: string) {
    // Teams are created via "Add row" which creates a "New Team" entry directly
    const addRowButton = this.page.getByRole('button', { name: /add row/i });
    await addRowButton.click();
    // If a name is provided, rename inline by clicking the name cell
    if (name) {
      const newTeamRow = this.page
        .locator('tr')
        .filter({ hasText: 'New Team' })
        .last();
      await newTeamRow.locator('span').filter({ hasText: 'New Team' }).click();
      const input = newTeamRow.locator('input');
      await input.waitFor({ state: 'visible', timeout: 3000 });
      await input.fill(name);
      await input.press('Enter');
    }
  }
}

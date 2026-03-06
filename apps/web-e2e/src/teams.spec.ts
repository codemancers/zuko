import { test, expect } from './fixtures/test-fixtures';

test.describe('Team Management', () => {
  test('should manage team lifecycle (create, update, remove)', async ({
    createOrgPage,
    teamsPage,
    page,
    auth,
  }) => {
    // 1. Create an organization first
    const orgName = `Org for Team ${Date.now()}`;
    const orgSlug = `org-team-${Date.now()}`;
    
    await createOrgPage.goto();
    await createOrgPage.createOrganization(orgName, orgSlug);
    await page.waitForURL('**/chat');

    // 2. Navigate to Teams page
    await teamsPage.goto(orgSlug);
    
    // 3. Create a team
    const teamName = `Engineering ${Date.now()}`;
    await teamsPage.createTeam(teamName);

    // 4. Verify team is created and redirected to settings
    await expect(page.getByText(`Team "${teamName}" created successfully`)).toBeVisible();
    await page.waitForURL('**/settings?tab=teams');
    await expect(page.locator('table')).toContainText(teamName);

    // 5. Update the team
    const updatedTeamName = `${teamName} Updated`;
    const teamRow = page.locator('tr').filter({ hasText: teamName });
    await teamRow.getByRole('button', { name: /more options/i }).click();
    await page.getByRole('menuitem', { name: /update team/i }).click();
    
    const teamNameInput = page.getByLabel(/team name/i);
    await teamNameInput.fill(updatedTeamName);
    await page.getByRole('button', { name: /^update team$/i }).click();

    await expect(page.getByText(`Team "${updatedTeamName}" updated successfully`)).toBeVisible();
    await expect(page.locator('table')).toContainText(updatedTeamName);

    // 6. Remove the team
    await page.locator('tr').filter({ hasText: updatedTeamName })
      .getByRole('button', { name: /more options/i }).click();
    await page.getByRole('menuitem', { name: /remove team/i }).click();
    
    // Confirm in Alert
    await page.getByRole('button', { name: /^remove$/i }).click();

    await expect(page.getByText(`Team "${updatedTeamName}" removed`)).toBeVisible();
    await expect(page.locator('table')).not.toContainText(updatedTeamName);
  });
});

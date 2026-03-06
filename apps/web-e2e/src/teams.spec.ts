import { test, expect } from './fixtures/test-fixtures';

test.describe('Team Management', () => {
  test('should create a new team under an organization', async ({
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
    
    // Should be redirected to settings with tab=teams
    await page.waitForURL('**/settings?tab=teams');
    
    // Verify team is visible in the list on settings page
    await expect(page.locator('ul.mt-10')).toContainText(teamName);
  });
});

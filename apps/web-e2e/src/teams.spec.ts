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

    // 3. Create a team via "Add row" — creates "New Team" directly
    const addRowButton = page.getByRole('button', { name: /add row/i });
    await addRowButton.click();
    await expect(page.getByText('Team created')).toBeVisible();

    // Wait for the "New Team" row to appear
    await expect(page.locator('table').getByText('New Team')).toBeVisible({
      timeout: 10000,
    });

    // 4. Rename "New Team" inline — click the name span to enter edit mode
    await page.locator('table').getByText('New Team').last().click();
    // After clicking, the span is replaced by an input — find the first input in the table
    const nameInput = page.locator('table input').first();
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    const teamName = `Engineering ${Date.now()}`;
    await nameInput.fill(teamName);
    await nameInput.press('Enter');

    await expect(page.getByText(`Team renamed to "${teamName}"`)).toBeVisible();
    await expect(page.locator('table')).toContainText(teamName);

    // 5. Remove the team
    await page
      .locator('tr')
      .filter({ hasText: teamName })
      .getByRole('button', { name: /remove team/i })
      .click();

    // Confirm in Alert
    await page.getByRole('button', { name: /^remove$/i }).click();

    await expect(page.getByText(`Team "${teamName}" removed`)).toBeVisible();
    await expect(page.locator('table')).not.toContainText(teamName);
  });
});

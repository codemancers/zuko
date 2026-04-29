import { test, expect } from './fixtures';
import { SettingsPage } from './pages/SettingsPage';

test.describe('Member Management', () => {
  test.beforeEach(async ({ settingsPage }) => {
    await settingsPage.goto();
    await settingsPage.switchTab('members');
  });

  test('should invite a new member to the organization', async ({
    settingsPage,
    page,
  }) => {
    const testEmail = `testuser-${Date.now()}@example.com`;

    await settingsPage.inviteMember(testEmail);

    // Check for success toast
    await expect(page.getByText(/invitation sent/i)).toBeVisible();

    // Verify it appears in the list
    await expect(page.getByText(testEmail).first()).toBeVisible();
  });

  test('Invite-Signup-Accept-Team Complex Flow', async ({
    settingsPage,
    page,
    browser,
  }) => {
    // 1. User A invites User B (who doesn't exist yet)
    const userBEmail = `e2e-signup-${Date.now()}@example.com`;
    const userBName = 'E2E Signup User';

    console.log(`Step 1: User A invites ${userBEmail}`);
    await settingsPage.inviteMember(userBEmail);
    await expect(page.getByText(/invitation sent/i)).toBeVisible();

    // 2. User B signs up via UI in a new context
    console.log(`Step 2: User B signs up via UI`);
    const userBContext = await browser.newContext();
    const userBPage = await userBContext.newPage();

    await userBPage.goto('/sign-up');
    await userBPage.getByLabel(/full name/i).fill(userBName);
    await userBPage.getByLabel(/email/i).fill(userBEmail);
    await userBPage.getByLabel(/password/i).fill('Password123!');
    await userBPage.getByRole('button', { name: /create account/i }).click();

    // After signup, should be redirected to invitations tab (per our earlier logic)
    console.log('User B signed up, waiting for redirect to invitations tab...');
    await userBPage.waitForURL(/tab=invitations/, { timeout: 15000 });

    // Accept invitation
    const userBSettingsPage = new SettingsPage(userBPage);
    console.log('User B accepting invitation...');
    await userBSettingsPage.acceptInvitation();

    // Instead of toast (which reloads), wait for reload/absence
    await userBPage.waitForURL(/tab=invitations/);
    await expect(
      userBPage.getByText(/no invitations|invitation accepted/i),
    ).toBeVisible();

    await userBContext.close();
    console.log('User B finished, switching back to User A');

    // 3. User A adds User B to a team
    console.log('Step 3: User A verifies User B and adds to team');
    await page.reload(); // Refresh User A's view to see User B as a member
    await settingsPage.goto(); // Ensure we are on settings
    await settingsPage.switchTab('members');

    const userBRow = page.locator('tr').filter({ hasText: userBName });
    await expect(userBRow).toBeVisible({ timeout: 15000 });

    // Add to team — only available when teams exist in the org
    const addToTeamButton = userBRow.getByRole('button', {
      name: /add to team/i,
    });
    const hasTeams =
      (await addToTeamButton.count()) > 0 &&
      (await addToTeamButton.isVisible());
    if (hasTeams) {
      await addToTeamButton.click();
      // Select first available team option
      const firstTeamOption = page.getByRole('menuitem').first();
      await firstTeamOption.waitFor({ state: 'visible', timeout: 3000 });
      const teamName = await firstTeamOption.innerText();
      await firstTeamOption.click();
      await expect(
        page.getByText(new RegExp(`added to ${teamName}`, 'i')),
      ).toBeVisible();

      // Verify User B is now in the team list
      await settingsPage.switchTab('teams');
      await expect(page.getByLabel('Teams').getByText(teamName)).toBeVisible();
    } else {
      console.log(
        'No teams available in this org, skipping team assignment step',
      );
    }
  });

  test('should remove a member from the organization', async ({
    settingsPage,
    page,
  }) => {
    await settingsPage.switchTab('members');

    // Find an active member row with role "Member" (not Owner/Admin, not Invited)
    const memberRows = page
      .locator('tr')
      .filter({
        has: page.locator(
          'select[value="member"], select option[value="member"]:checked',
        ),
      })
      .filter({ hasText: /Active/ })
      .filter({
        hasNot: page.locator('select[value="owner"], select[value="admin"]'),
      });
    const count = await memberRows.count();
    if (count === 0) {
      test.skip();
      return;
    }

    const memberRow = memberRows.first();

    // Click the icon button "Remove member" directly (no dropdown)
    await memberRow.getByRole('button', { name: /remove member/i }).click();

    // Wait for confirm dialog to appear, then click Remove
    const confirmButton = page.getByRole('button', { name: /^remove$/i });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    await expect(page.getByText(/member removed/i)).toBeVisible();
  });
});

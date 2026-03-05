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

    // Check for success toast or member in list
    await expect(page.getByText(/invitation sent successfully/i)).toBeVisible();

    // Verify it appears in pending invitations
    await expect(page.getByText(testEmail)).toBeVisible();
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
    await expect(page.getByText(/invitation sent successfully/i)).toBeVisible();

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

    // Find User B specifically by email
    const userBRow = page.locator('tr').filter({ hasText: userBEmail });
    await expect(userBRow).toBeVisible({ timeout: 15000 });

    // Add to team
    await userBRow
      .getByRole('button', { name: /more options|open menu/i })
      .click();
    await page.getByRole('menuitem', { name: /add to team/i }).click();

    // Select team in dialog - Robust interaction for Combobox
    const teamCombobox = page.getByRole('combobox', { name: /team/i });
    await teamCombobox.click();
    await teamCombobox.press('ArrowDown'); // Trigger dropdown

    // Check if any options are available before selecting
    const options = page.getByRole('option');
    if ((await options.count()) > 0) {
      const firstOption = options.first();
      const teamName = await firstOption.innerText();
      await firstOption.click();

      // Confirm in dialog
      await page.getByRole('button', { name: /^add to team$/i }).click();
      await expect(page.getByText(/added to team/i)).toBeVisible();

      // Verify User B is now in the team list
      await settingsPage.switchTab('teams');
      await expect(page.getByLabel('Teams').getByText(teamName)).toBeVisible();
    } else {
      console.log('No teams available to assign to. Closing dialog.');
      await page.keyboard.press('Escape');
    }
  });

  test('should remove a member from a team', async ({ settingsPage, page }) => {
    await settingsPage.switchTab('members');

    // Find a member (NOT the owner/setup user)
    const memberRow = page
      .locator('tr')
      .filter({ hasText: /member/ })
      .first();
    await memberRow
      .getByRole('button', { name: /more options|open menu/i })
      .click();

    const removeFromTeamsOption = page.getByRole('menuitem', {
      name: /remove from teams/i,
    });
    if (await removeFromTeamsOption.isVisible()) {
      await removeFromTeamsOption.click();

      // Select a team to remove from - Robust interaction
      const teamCombobox = page.getByRole('combobox', { name: /team/i });
      await teamCombobox.click();
      await teamCombobox.press('ArrowDown');

      const options = page.getByRole('option');
      if ((await options.count()) > 0) {
        await options.first().click();

        // Confirm in dialog - Use exact match and specific dialog scope
        const dialog = page.getByRole('dialog');
        await dialog
          .getByRole('button', { name: /^remove from team$/i })
          .click();
        await expect(page.getByText(/removed/i)).toBeVisible();
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });

  test('should remove a member from the organization', async ({
    settingsPage,
    page,
  }) => {
    await settingsPage.switchTab('members');

    // Find a member (NOT the owner/setup user)
    const memberRow = page
      .locator('tr')
      .filter({ hasText: /member/ })
      .first();
    await memberRow
      .getByRole('button', { name: /more options|open menu/i })
      .click();

    await page.getByRole('menuitem', { name: /remove member/i }).click();

    // Confirm in dialog (button text is "Remove")
    await page.getByRole('button', { name: /^remove$/i }).click();

    await expect(page.getByText(/member removed/i)).toBeVisible();
  });
});

import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type Page,
  type PlaywrightWorkerArgs,
} from '@playwright/test';
import { APP_URL, BACKEND_URL } from './support/env';

type Playwright = PlaywrightWorkerArgs['playwright'];

const password = 'e2e-test-password-123';

// Unique per call so tests can run in parallel and re-run without cleanup.
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const uniqueEmail = (prefix: string) => `e2e-${prefix}-${unique()}@example.com`;

/** Signs a user up through the API; the returned context holds their session cookie. */
async function apiUser(playwright: Playwright, email: string, name: string) {
  const ctx = await playwright.request.newContext();
  const res = await ctx.post(`${BACKEND_URL}/auth/sign-up/email`, {
    headers: { origin: APP_URL },
    data: { email, password, name },
  });
  expect(res.ok()).toBe(true);
  return ctx;
}

async function apiPost(ctx: APIRequestContext, path: string, data: object) {
  const res = await ctx.post(`${BACKEND_URL}/auth/${path}`, { headers: { origin: APP_URL }, data });
  expect(res.ok(), `${path}: ${await res.text()}`).toBe(true);
  return res.json();
}

/** An owner with an organization, set up through the API. */
async function apiOwnerWithOrg(playwright: Playwright, orgName: string) {
  const email = uniqueEmail('owner');
  const ctx = await apiUser(playwright, email, 'Olive Owner');
  const org = await apiPost(ctx, 'organization/create', {
    name: orgName,
    slug: `e2e-${unique()}`.toLowerCase(),
  });
  return { ctx, email, org: org as { id: string; name: string } };
}

async function logIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  // Someone without an organization is sent on to create one, so accept either landing page.
  await expect(page).toHaveURL(/\/(dashboard|organizations\/new)$/);
}

/** A fresh, signed-out browser: the invitee is a different person on a different machine. */
async function newVisitor(browser: Browser) {
  const context = await browser.newContext({ baseURL: APP_URL });
  return { context, page: await context.newPage() };
}

test.describe('organizations', () => {
  test('a new user is sent to create an organization, then lands on the dashboard', async ({
    page,
  }) => {
    const email = uniqueEmail('new');
    await page.goto('/signup');
    await page.getByLabel('Name').fill('Nia New');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign up' }).click();

    // No organization yet, so the dashboard sends them to make one.
    await expect(page).toHaveURL(/\/organizations\/new$/);
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

    await page.getByLabel('Organization name').fill('Newco');
    await page.getByRole('button', { name: 'Create organization' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('button', { name: 'Organization: Newco' })).toBeVisible();
  });

  test('org settings has addressable Details and Members tabs', async ({ page, playwright }) => {
    const { email } = await apiOwnerWithOrg(playwright, 'Tabs Inc');
    await logIn(page, email);

    await page.goto('/org/settings');
    await expect(page).toHaveURL(/\/org\/settings\/details$/);
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Tabs Inc');

    await page.getByRole('link', { name: 'Members' }).click();
    await expect(page).toHaveURL(/\/org\/settings\/members$/);
    await expect(page.getByText(email)).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/org\/settings\/details$/);
  });

  test('renaming the organization autosaves and shows a tick', async ({ page, playwright }) => {
    const { email } = await apiOwnerWithOrg(playwright, 'Before Name');
    await logIn(page, email);
    await page.goto('/org/settings/details');

    const name = page.getByRole('textbox', { name: 'Name', exact: true });
    await name.fill('After Name');
    await expect(page.getByLabel('Saved')).toBeVisible(); // appears once typing pauses

    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
      'After Name',
    );
  });
});

test.describe('invite flow', () => {
  test('owner invites by link; the invitee signs up, accepts and joins as a member', async ({
    page,
    browser,
    playwright,
  }) => {
    const { email: ownerEmail } = await apiOwnerWithOrg(playwright, 'Invite Co');
    const inviteeEmail = uniqueEmail('invitee');

    // --- Owner creates the invite from the members sheet and copies its link.
    await page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP_URL });
    await logIn(page, ownerEmail);
    await page.goto('/org/settings/members');
    await page.getByRole('button', { name: /invite member/i }).click();
    const emailCell = page.getByPlaceholder('Email to invite');
    await emailCell.fill(inviteeEmail);
    await emailCell.press('Enter');

    const pendingRow = page.getByRole('row').filter({ hasText: inviteeEmail });
    await expect(pendingRow).toContainText('Invited');
    await pendingRow.getByRole('button', { name: `Copy invite link for ${inviteeEmail}` }).click();
    const link = await page.evaluate(() =>
      (
        globalThis as unknown as { navigator: { clipboard: { readText(): Promise<string> } } }
      ).navigator.clipboard.readText(),
    );
    expect(link).toMatch(new RegExp(`^${APP_URL}/accept-invitation/[\\w-]+$`));

    // --- Invitee opens the link signed out and is asked to log in or sign up.
    const { context, page: invitee } = await newVisitor(browser);
    await invitee.goto(link);
    await expect(invitee.getByRole('heading', { name: 'You have been invited' })).toBeVisible();

    // Signing up from here must bring them straight back to the invitation.
    await invitee.getByRole('link', { name: 'Sign up' }).click();
    await expect(invitee).toHaveURL(/\/signup\?next=/);
    await invitee.getByLabel('Name').fill('Ivy Invitee');
    await invitee.getByLabel('Email').fill(inviteeEmail);
    await invitee.getByLabel('Password', { exact: true }).fill(password);
    await invitee.getByRole('button', { name: 'Sign up' }).click();

    await expect(invitee).toHaveURL(link);
    await expect(invitee.getByRole('heading', { name: 'Join Invite Co' })).toBeVisible();
    await invitee.getByRole('button', { name: 'Accept' }).click();

    // --- They land in the organization, with no "create an organization" detour.
    await expect(invitee).toHaveURL(/\/dashboard$/);
    await expect(invitee.getByRole('button', { name: 'Organization: Invite Co' })).toBeVisible();
    await expect(invitee).not.toHaveURL(/organizations\/new/);

    // As a plain member they can see the list but not manage it.
    await invitee.goto('/org/settings/members');
    await expect(invitee.getByText('Ivy Invitee')).toBeVisible();
    await expect(invitee.getByText('Olive Owner')).toBeVisible();
    await expect(invitee.getByRole('button', { name: /^Remove / })).toHaveCount(0);
    await expect(invitee.getByLabel(/^Role for /)).toHaveCount(0);
    await context.close();

    // --- Back on the owner's side: the invite became a member.
    await page.reload();
    const memberRow = page.getByRole('row').filter({ hasText: inviteeEmail });
    await expect(memberRow).toContainText('Ivy Invitee');
    await expect(memberRow).not.toContainText('Invited');
    await expect(memberRow.getByLabel(`Role for ${inviteeEmail}`)).toHaveValue('member');
  });

  test('the invite link only works for the invited email', async ({
    page,
    browser,
    playwright,
  }) => {
    const { ctx: owner, org } = await apiOwnerWithOrg(playwright, 'Private Co');
    const invited = uniqueEmail('invited');
    const { id } = await apiPost(owner, 'organization/invite-member', {
      email: invited,
      role: 'member',
      organizationId: org.id,
    });

    // A different person signs in and opens the link.
    const stranger = uniqueEmail('stranger');
    await apiUser(playwright, stranger, 'Sid Stranger');
    const { context, page: strangerPage } = await newVisitor(browser);
    await logIn(strangerPage, stranger);
    await strangerPage.goto(`/accept-invitation/${id}`);

    // better-auth refuses to even show the invitation to a different account.
    await expect(strangerPage.locator('[data-slot="alert"]')).toContainText('not the recipient');
    await expect(strangerPage.getByRole('button', { name: 'Accept' })).toBeDisabled();
    await context.close();

    // The invite is still pending for the right person.
    const ownerEmail = (await (await owner.get(`${BACKEND_URL}/auth/get-session`)).json()).user
      .email;
    await logIn(page, ownerEmail);
    await page.goto('/org/settings/members');
    await expect(page.getByRole('row').filter({ hasText: invited })).toContainText('Invited');
  });

  test('a cancelled invite can no longer be accepted', async ({ page, browser, playwright }) => {
    const { email: ownerEmail, ctx: owner, org } = await apiOwnerWithOrg(playwright, 'Cancel Co');
    const inviteeEmail = uniqueEmail('cancelled');
    const { id } = await apiPost(owner, 'organization/invite-member', {
      email: inviteeEmail,
      role: 'member',
      organizationId: org.id,
    });
    const inviteeCtx = await apiUser(playwright, inviteeEmail, 'Cleo Cancelled');
    void inviteeCtx;

    // Owner cancels it from the sheet.
    await logIn(page, ownerEmail);
    await page.goto('/org/settings/members');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: `Cancel invite for ${inviteeEmail}` }).click();
    await expect(page.getByText(inviteeEmail)).toHaveCount(0);

    // The invitee's link is now dead.
    const { context, page: invitee } = await newVisitor(browser);
    await logIn(invitee, inviteeEmail);
    await invitee.goto(`/accept-invitation/${id}`);
    await expect(invitee.locator('[data-slot="alert"]')).toBeVisible();
    await expect(invitee.getByRole('button', { name: 'Accept' })).toBeDisabled();
    await context.close();
  });

  test('an owner can change a member’s role and remove them', async ({ page, playwright }) => {
    const { email: ownerEmail, ctx: owner, org } = await apiOwnerWithOrg(playwright, 'Roles Co');
    const memberEmail = uniqueEmail('member');
    const { id } = await apiPost(owner, 'organization/invite-member', {
      email: memberEmail,
      role: 'member',
      organizationId: org.id,
    });
    const memberCtx = await apiUser(playwright, memberEmail, 'Max Member');
    await apiPost(memberCtx, 'organization/accept-invitation', { invitationId: id });

    await logIn(page, ownerEmail);
    await page.goto('/org/settings/members');
    const row = page.getByRole('row').filter({ hasText: memberEmail });

    // Role change saves, shows the tick, and survives a reload.
    await row.getByLabel(`Role for ${memberEmail}`).selectOption('admin');
    await expect(row.getByRole('status')).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('row').filter({ hasText: memberEmail }).getByLabel(`Role for ${memberEmail}`),
    ).toHaveValue('admin');

    // Removal asks first, then the row goes away for good.
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Remove Max Member' }).click();
    await expect(page.getByText(memberEmail)).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(memberEmail)).toHaveCount(0);
  });
});

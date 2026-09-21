import { test, expect } from './fixtures';
import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Prospect and Lead Activity Timeline.
 *
 * Both entities carry the same comment timeline the CRM records use. A prospect
 * shows it beneath its campaign feed; the two are separate sections and must
 * stay that way — see docs/concepts/prospect-lifecycle.mdx.
 */

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

/**
 * Only a missing session is an environment problem worth skipping over. Any
 * other failure is the API telling us something is broken, and a skipped test
 * would hide it — this suite once reported green while both lead tests were
 * being skipped on a 400.
 */
function assertCreated(response: APIResponse, what: string) {
  const status = response.status();
  test.skip(
    status === 401 || status === 403,
    'API session unavailable in this environment',
  );
  expect(
    response.ok(),
    `Creating a ${what} failed with ${status}: ${response.statusText()}`,
  ).toBeTruthy();
}

async function createProspect(
  request: APIRequestContext,
  name: string,
): Promise<{ id: number }> {
  const created = await request.post(`${API}/api/prospects`, {
    data: {
      name,
      email: `${name.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}@example.com`,
      companyName: 'E2E Corp',
    },
    failOnStatusCode: false,
  });
  assertCreated(created, 'prospect');
  return created.json();
}

/**
 * Leads are made the way the product makes them: by promoting an engaged
 * prospect. Posting to /leads directly would need an ICP profile fixture and
 * would not exercise the promotion that opens a lead's timeline.
 */
async function createLead(
  request: APIRequestContext,
  name: string,
): Promise<{ id: number }> {
  const prospect = await createProspect(request, name);

  const engaged = await request.patch(
    `${API}/api/prospects/${prospect.id}/status`,
    { data: { status: 'engaged' }, failOnStatusCode: false },
  );
  assertCreated(engaged, 'prospect status change');

  const promoted = await request.post(
    `${API}/api/prospects/${prospect.id}/promote`,
    { failOnStatusCode: false },
  );
  assertCreated(promoted, 'lead');

  const { lead } = await promoted.json();
  return lead;
}

test.describe('Prospect Activity Timeline - Authenticated', () => {
  test('shows the comment timeline alongside the campaign feed', async ({
    prospectDetailPage,
    request,
  }) => {
    const prospect = await createProspect(request, 'E2E Timeline Prospect');

    await prospectDetailPage.goto(prospect.id);

    // Two feeds, two names: the campaign touches and the comment timeline.
    await expect(prospectDetailPage.campaignActivitySection).toBeVisible();
    await expect(prospectDetailPage.activitySection).toBeVisible();
    await expect(prospectDetailPage.commentInput).toBeVisible({
      timeout: 10000,
    });
  });

  test('disables the post button until a comment is written', async ({
    prospectDetailPage,
    request,
  }) => {
    const prospect = await createProspect(request, 'E2E Empty Comment');

    await prospectDetailPage.goto(prospect.id);

    expect(await prospectDetailPage.isPostButtonDisabled()).toBeTruthy();
  });

  test('posts a comment and shows it on the timeline', async ({
    prospectDetailPage,
    request,
  }) => {
    const prospect = await createProspect(request, 'E2E Commented Prospect');

    await prospectDetailPage.goto(prospect.id);
    const comment = `Left them a voicemail ${Date.now()}`;
    await prospectDetailPage.createComment(comment);

    await prospectDetailPage.openActivityHistory();
    await prospectDetailPage.expectActivityEntry(comment);
  });

  test('records the creation of the prospect as a system event', async ({
    prospectDetailPage,
    request,
  }) => {
    const prospect = await createProspect(request, 'E2E System Event Prospect');

    await prospectDetailPage.goto(prospect.id);
    await prospectDetailPage.openActivityHistory();

    await prospectDetailPage.expectActivityEntry(/added this prospect/i);
  });

  test('records a suppression on the timeline', async ({
    prospectDetailPage,
    page,
    request,
  }) => {
    const prospect = await createProspect(request, 'E2E Suppressed Prospect');

    await prospectDetailPage.goto(prospect.id);
    await page
      .getByRole('button', { name: /Suppress/i })
      .first()
      .click();

    await prospectDetailPage.openActivityHistory();
    await prospectDetailPage.expectActivityEntry(/suppressed this prospect/i);
  });
});

test.describe('Lead Activity Timeline - Authenticated', () => {
  test('shows the timeline and its creation event', async ({
    leadDetailPage,
    request,
  }) => {
    const lead = await createLead(request, 'E2E Timeline Lead');

    await leadDetailPage.goto(lead.id);

    await expect(leadDetailPage.activitySection).toBeVisible();
    await leadDetailPage.openActivityHistory();
    await leadDetailPage.expectActivityEntry(/created this lead/i);
  });

  test('posts a comment on a lead', async ({ leadDetailPage, request }) => {
    const lead = await createLead(request, 'E2E Commented Lead');

    await leadDetailPage.goto(lead.id);
    const comment = `Asked for a second call ${Date.now()}`;
    await leadDetailPage.createComment(comment);

    await leadDetailPage.openActivityHistory();
    await leadDetailPage.expectActivityEntry(comment);
  });
});

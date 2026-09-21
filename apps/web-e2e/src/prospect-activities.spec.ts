import { test, expect } from './fixtures';
import type { APIRequestContext } from '@playwright/test';

/**
 * Prospect and Lead Activity Timeline.
 *
 * Both entities carry the same comment timeline the CRM records use. A prospect
 * shows it beneath its campaign feed; the two are separate sections and must
 * stay that way — see docs/concepts/prospect-lifecycle.mdx.
 */

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

async function createProspect(request: APIRequestContext, name: string) {
  const created = await request.post(`${API}/api/prospects`, {
    data: {
      name,
      email: `${name.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}@example.com`,
      companyName: 'E2E Corp',
    },
    failOnStatusCode: false,
  });
  return created;
}

async function createLead(request: APIRequestContext, name: string) {
  const created = await request.post(`${API}/api/leads`, {
    data: {
      name,
      email: `${name.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}@example.com`,
      companyName: 'E2E Corp',
    },
    failOnStatusCode: false,
  });
  return created;
}

test.describe('Prospect Activity Timeline - Authenticated', () => {
  test('shows the comment timeline alongside the campaign feed', async ({
    prospectDetailPage,
    request,
  }) => {
    const created = await createProspect(request, 'E2E Timeline Prospect');
    test.skip(!created.ok(), 'API session unavailable in this environment');
    const prospect = await created.json();

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
    const created = await createProspect(request, 'E2E Empty Comment');
    test.skip(!created.ok(), 'API session unavailable in this environment');
    const prospect = await created.json();

    await prospectDetailPage.goto(prospect.id);

    expect(await prospectDetailPage.isPostButtonDisabled()).toBeTruthy();
  });

  test('posts a comment and shows it on the timeline', async ({
    prospectDetailPage,
    request,
  }) => {
    const created = await createProspect(request, 'E2E Commented Prospect');
    test.skip(!created.ok(), 'API session unavailable in this environment');
    const prospect = await created.json();

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
    const created = await createProspect(request, 'E2E System Event Prospect');
    test.skip(!created.ok(), 'API session unavailable in this environment');
    const prospect = await created.json();

    await prospectDetailPage.goto(prospect.id);
    await prospectDetailPage.openActivityHistory();

    await prospectDetailPage.expectActivityEntry(/added this prospect/i);
  });

  test('records a suppression on the timeline', async ({
    prospectDetailPage,
    page,
    request,
  }) => {
    const created = await createProspect(request, 'E2E Suppressed Prospect');
    test.skip(!created.ok(), 'API session unavailable in this environment');
    const prospect = await created.json();

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
    const created = await createLead(request, 'E2E Timeline Lead');
    test.skip(!created.ok(), 'API session unavailable in this environment');
    const lead = await created.json();

    await leadDetailPage.goto(lead.id);

    await expect(leadDetailPage.activitySection).toBeVisible();
    await leadDetailPage.openActivityHistory();
    await leadDetailPage.expectActivityEntry(/created this lead/i);
  });

  test('posts a comment on a lead', async ({ leadDetailPage, request }) => {
    const created = await createLead(request, 'E2E Commented Lead');
    test.skip(!created.ok(), 'API session unavailable in this environment');
    const lead = await created.json();

    await leadDetailPage.goto(lead.id);
    const comment = `Asked for a second call ${Date.now()}`;
    await leadDetailPage.createComment(comment);

    await leadDetailPage.openActivityHistory();
    await leadDetailPage.expectActivityEntry(comment);
  });
});

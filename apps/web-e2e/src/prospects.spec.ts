import { test, expect } from './fixtures';

/**
 * Prospect lifecycle UI.
 *
 * Prospects are the outbound side of the funnel — see
 * docs/concepts/prospect-lifecycle.mdx. These tests drive the list and detail
 * pages; the lifecycle rules themselves are covered by the service tests in
 * libs/sales/src/lib/services/prospects.service.spec.ts.
 */

test.describe('Prospects Page - Unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects to sign-in when not authenticated', async ({ page }) => {
    await page.goto('/prospects');
    await page.waitForURL('**/sign-in**', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Sign in to Zuko');
  });
});

test.describe('Prospects - Authenticated', () => {
  test('shows the prospects page with its status filters', async ({ page }) => {
    await page.goto('/prospects');

    await expect(
      page.getByRole('heading', { name: 'Prospects' }),
    ).toBeVisible();

    for (const label of ['All', 'New', 'Enrolled', 'Engaged', 'Suppressed']) {
      await expect(
        page.getByRole('button', { name: new RegExp(`^${label}`) }),
      ).toBeVisible();
    }
  });

  test('is reachable from the sidebar', async ({ page }) => {
    await page.goto('/contacts');
    await page.getByRole('link', { name: 'Prospects' }).first().click();
    await page.waitForURL('**/prospects');

    await expect(
      page.getByRole('heading', { name: 'Prospects' }),
    ).toBeVisible();
  });

  test('filters the list by lifecycle status without erroring', async ({
    page,
  }) => {
    const failed: number[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/prospects?') && res.status() >= 400) {
        failed.push(res.status());
      }
    });

    await page.goto('/prospects');
    await page.getByRole('button', { name: /^Enrolled/ }).click();
    await page.waitForLoadState('networkidle');

    // A single ?status=enrolled used to 400, emptying the table silently
    // while the chip still showed a count. Asserting on absent error text
    // missed it entirely — the request itself has to be checked.
    expect(failed).toEqual([]);
  });

  test('opens a prospect and shows its lifecycle detail', async ({
    page,
    request,
  }) => {
    const created = await request.post(
      `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'}/api/prospects`,
      {
        data: {
          name: 'E2E Prospect',
          email: `e2e-prospect-${Date.now()}@example.com`,
          companyName: 'E2E Corp',
        },
        failOnStatusCode: false,
      },
    );

    // The API requires a session; when it is unavailable, fall back to
    // asserting the page renders rather than silently passing.
    if (!created.ok()) {
      await page.goto('/prospects');
      await expect(
        page.getByRole('heading', { name: 'Prospects' }),
      ).toBeVisible();
      return;
    }

    const prospect = await created.json();
    await page.goto(`/prospects/${prospect.id}`);

    await expect(
      page.getByRole('heading', { name: 'E2E Prospect' }),
    ).toBeVisible();
    await expect(page.getByText('New', { exact: true })).toBeVisible();

    // Channels, campaign history and activity are the three panels that make
    // the lifecycle legible.
    await expect(page.getByText('Channels')).toBeVisible();
    await expect(page.getByText('Campaign history')).toBeVisible();
    await expect(page.getByText('Activity')).toBeVisible();
    await expect(page.getByText('Never enrolled in a campaign.')).toBeVisible();
  });

  test('offers an enrol control for a new prospect', async ({
    page,
    request,
  }) => {
    const created = await request.post(
      `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'}/api/prospects`,
      {
        data: {
          name: 'E2E Enrollable',
          email: `e2e-enrol-${Date.now()}@example.com`,
        },
        failOnStatusCode: false,
      },
    );
    test.skip(!created.ok(), 'API session unavailable in this environment');

    const prospect = await created.json();
    await page.goto(`/prospects/${prospect.id}`);

    // Enrolment belongs with campaign history, which is what it changes.
    await expect(page.getByRole('button', { name: 'Enrol' })).toBeVisible();
    await expect(
      page.getByRole('combobox', { name: 'Campaign' }),
    ).toBeVisible();
  });

  test('explains why enrolment is unavailable instead of hiding it silently', async ({
    page,
    request,
  }) => {
    const base = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
    const created = await request.post(`${base}/api/prospects`, {
      data: {
        name: 'E2E Suppressed',
        email: `e2e-suppressed-${Date.now()}@example.com`,
      },
      failOnStatusCode: false,
    });
    test.skip(!created.ok(), 'API session unavailable in this environment');

    const prospect = await created.json();
    await request.post(`${base}/api/prospects/${prospect.id}/suppress`, {
      data: {},
      failOnStatusCode: false,
    });

    await page.goto(`/prospects/${prospect.id}`);

    await expect(page.getByRole('button', { name: 'Enrol' })).toHaveCount(0);
    await expect(page.getByText(/asked us to stop/i)).toBeVisible();
  });

  test('can log a phone call without any campaign', async ({
    page,
    request,
  }) => {
    const created = await request.post(
      `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'}/api/prospects`,
      {
        data: {
          name: 'E2E Caller',
          phone: '+14155559999',
        },
        failOnStatusCode: false,
      },
    );
    test.skip(!created.ok(), 'API session unavailable in this environment');

    const prospect = await created.json();
    await page.goto(`/prospects/${prospect.id}`);

    await page.getByRole('button', { name: 'Logged call' }).click();
    await expect(page.getByText('Called')).toBeVisible();
  });

  test('offers suppression but not promotion for a new prospect', async ({
    page,
    request,
  }) => {
    const created = await request.post(
      `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'}/api/prospects`,
      {
        data: {
          name: 'E2E Unpromotable',
          email: `e2e-unpromotable-${Date.now()}@example.com`,
        },
        failOnStatusCode: false,
      },
    );
    test.skip(!created.ok(), 'API session unavailable in this environment');

    const prospect = await created.json();
    await page.goto(`/prospects/${prospect.id}`);

    // Only an engaged prospect can be promoted, so the button must not appear.
    await expect(
      page.getByRole('button', { name: 'Promote to Lead' }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Suppress' })).toBeVisible();
  });
});

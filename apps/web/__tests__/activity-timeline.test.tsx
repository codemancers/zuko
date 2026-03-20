/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ActivityTimeline from '@/components/Activity/ActivityTimeline';

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockGetTimeline = vi.fn();
vi.mock('@/lib/api/activities', () => ({
  activitiesApi: {
    getTimeline: (...args: unknown[]) => mockGetTimeline(...args),
    createComment: vi.fn(),
    updateActivity: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function makeActivity(overrides: Record<string, unknown>) {
  return {
    id: 1,
    activityType: 'comment',
    content: null,
    metadata: null,
    actorId: null,
    actor: { name: 'System' },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderTimeline(activities: object[] = []) {
  mockGetTimeline.mockResolvedValue({ activities });

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ActivityTimeline entityType="deal" entityId={1} />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ActivityTimeline - system event text', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "No activity yet" when there are no activities', async () => {
    renderTimeline([]);
    expect(await screen.findByText('No activity yet')).toBeInTheDocument();
  });

  it('renders "created this deal" for deal_created', async () => {
    renderTimeline([makeActivity({ activityType: 'deal_created' })]);
    expect(await screen.findByText('created this deal')).toBeInTheDocument();
  });

  it('renders "moved deal from X to Y" for stage_change', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'stage_change',
        metadata: { from: 'prospecting', to: 'qualification' },
      }),
    ]);
    expect(
      await screen.findByText('moved deal from Prospecting to Qualification'),
    ).toBeInTheDocument();
  });

  it('renders "updated X from Y to Z" for field_update with a previous value', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'field_update',
        metadata: { field: 'value', from: 5000, to: 9999 },
      }),
    ]);
    expect(
      await screen.findByText('updated value from "5000" to "9999"'),
    ).toBeInTheDocument();
  });

  it('renders "set X to Y" for field_update without a previous value', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'field_update',
        metadata: { field: 'title', from: null, to: 'New Title' },
      }),
    ]);
    expect(
      await screen.findByText('set title to "New Title"'),
    ).toBeInTheDocument();
  });

  it('renders "marked deal as Won" for deal_closed with outcome=won', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'deal_closed',
        metadata: { outcome: 'won' },
      }),
    ]);
    expect(await screen.findByText('marked deal as Won')).toBeInTheDocument();
  });

  it('renders "marked deal as Lost" for deal_closed with outcome=lost', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'deal_closed',
        metadata: { outcome: 'lost' },
      }),
    ]);
    expect(await screen.findByText('marked deal as Lost')).toBeInTheDocument();
  });

  it('renders lost reason when present in deal_closed', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'deal_closed',
        metadata: { outcome: 'lost', lostReason: 'Price too high' },
      }),
    ]);
    expect(
      await screen.findByText('marked deal as Lost: Price too high'),
    ).toBeInTheDocument();
  });

  it('renders "linked company X" for company_linked', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'company_linked',
        metadata: { companyId: 5, companyName: 'Acme Corp' },
      }),
    ]);
    expect(
      await screen.findByText('linked company Acme Corp'),
    ).toBeInTheDocument();
  });

  it('renders "unlinked company X" for company_unlinked', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'company_unlinked',
        metadata: { companyId: 5, companyName: 'Acme Corp' },
      }),
    ]);
    expect(
      await screen.findByText('unlinked company Acme Corp'),
    ).toBeInTheDocument();
  });

  it('renders "linked contact X" for contact_linked', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'contact_linked',
        metadata: { contactId: 7, contactName: 'Jane Smith' },
      }),
    ]);
    expect(
      await screen.findByText('linked contact Jane Smith'),
    ).toBeInTheDocument();
  });

  it('renders "linked contact X as role" when role is present', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'contact_linked',
        metadata: { contactId: 7, contactName: 'Jane Smith', role: 'Decision Maker' },
      }),
    ]);
    expect(
      await screen.findByText('linked contact Jane Smith as Decision Maker'),
    ).toBeInTheDocument();
  });

  it('renders "unlinked contact X" for contact_unlinked', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'contact_unlinked',
        metadata: { contactId: 7, contactName: 'Jane Smith' },
      }),
    ]);
    expect(
      await screen.findByText('unlinked contact Jane Smith'),
    ).toBeInTheDocument();
  });

  it('renders "assigned X as owner" for owner_assigned', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'owner_assigned',
        metadata: { userId: 3, userName: 'Bob' },
      }),
    ]);
    expect(
      await screen.findByText('assigned Bob as owner'),
    ).toBeInTheDocument();
  });

  it('renders "removed X as owner" for owner_removed', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'owner_removed',
        metadata: { userId: 3, userName: 'Bob' },
      }),
    ]);
    expect(
      await screen.findByText('removed Bob as owner'),
    ).toBeInTheDocument();
  });

  it('renders multiple events in the timeline', async () => {
    renderTimeline([
      makeActivity({ id: 1, activityType: 'deal_created' }),
      makeActivity({
        id: 2,
        activityType: 'stage_change',
        metadata: { from: 'prospecting', to: 'proposal' },
      }),
      makeActivity({
        id: 3,
        activityType: 'company_linked',
        metadata: { companyName: 'Acme Corp' },
      }),
    ]);

    expect(await screen.findByText('created this deal')).toBeInTheDocument();
    expect(screen.getByText('moved deal from Prospecting to Proposal')).toBeInTheDocument();
    expect(screen.getByText('linked company Acme Corp')).toBeInTheDocument();
  });
});

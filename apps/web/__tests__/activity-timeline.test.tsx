/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ActivityTimeline from '@/components/Activity/ActivityTimeline';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

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

async function renderTimeline(
  activities: object[] = [],
  { autoShow = true } = {},
) {
  mockGetTimeline.mockResolvedValue({ activities });

  const result = render(
    <QueryClientProvider client={createQueryClient()}>
      <ActivityTimeline entityType="deal" entityId={1} />
    </QueryClientProvider>,
  );

  if (autoShow) {
    const showBtn = await screen.findByText(/SHOW HISTORY/i);
    fireEvent.click(showBtn);
  }

  return result;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ActivityTimeline - system event text', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders collapsed view by default', async () => {
    await renderTimeline([makeActivity({ content: 'hidden test' })], {
      autoShow: false,
    });
    expect(screen.queryByText('hidden test')).not.toBeInTheDocument();
  });

  it('toggles history visibility when Show/Hide History button is clicked', async () => {
    const user = userEvent.setup();
    const activities = [makeActivity({ id: 1, activityType: 'deal_created' })];
    mockGetTimeline.mockResolvedValue({ activities });

    render(
      <QueryClientProvider client={createQueryClient()}>
        <ActivityTimeline entityType="deal" entityId={1} />
      </QueryClientProvider>,
    );

    // 1. Initial state: Collapsed
    const showBtn = await screen.findByText(/SHOW HISTORY/i);
    expect(screen.queryByText('created this deal')).not.toBeInTheDocument();

    // 2. Expand: Click Show History
    await user.click(showBtn);
    expect(screen.getByText('created this deal')).toBeInTheDocument();
    expect(screen.getByText(/HIDE HISTORY/i)).toBeInTheDocument();

    // 3. Collapse: Click Hide History
    await user.click(screen.getByText(/HIDE HISTORY/i));
    expect(screen.queryByText('created this deal')).not.toBeInTheDocument();
    expect(screen.getByText(/SHOW HISTORY/i)).toBeInTheDocument();
  });

  it('shows "No activity yet" when there are no activities', async () => {
    await renderTimeline([]);
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
        metadata: {
          contactId: 7,
          contactName: 'Jane Smith',
          role: 'Decision Maker',
        },
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
    expect(await screen.findByText('removed Bob as owner')).toBeInTheDocument();
  });

  it('renders "created this task" for task_created', async () => {
    renderTimeline([makeActivity({ activityType: 'task_created' })]);
    expect(await screen.findByText('created this task')).toBeInTheDocument();
  });

  it('renders "moved task from X to Y" for task_status_changed', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'task_status_changed',
        metadata: { from: 'TODO', to: 'IN_PROGRESS' },
      }),
    ]);
    expect(
      await screen.findByText('moved task from To Do to In Progress'),
    ).toBeInTheDocument();
  });

  it('renders "added this prospect" for prospect_created', async () => {
    renderTimeline([makeActivity({ activityType: 'prospect_created' })]);
    expect(await screen.findByText('added this prospect')).toBeInTheDocument();
  });

  it('reads prospect status transitions as words', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'prospect_status_changed',
        metadata: { from: 'new', to: 'no_response' },
      }),
    ]);
    expect(
      await screen.findByText('moved prospect from new to no response'),
    ).toBeInTheDocument();
  });

  it('names the campaign and channel for prospect_enrolled', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'prospect_enrolled',
        metadata: {
          campaignId: 4,
          campaignName: 'Q3 Outbound',
          channel: 'email',
        },
      }),
    ]);
    expect(
      await screen.findByText('enrolled in Q3 Outbound on email'),
    ).toBeInTheDocument();
  });

  it('falls back to the campaign id when the name is missing', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'prospect_enrolled',
        metadata: { campaignId: 4, channel: 'linkedin' },
      }),
    ]);
    expect(
      await screen.findByText('enrolled in campaign 4 on linkedin'),
    ).toBeInTheDocument();
  });

  it('renders consent changes per channel', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'prospect_consent_changed',
        metadata: { channel: 'email', from: 'unknown', to: 'revoked' },
      }),
    ]);
    expect(
      await screen.findByText('set email consent to revoked'),
    ).toBeInTheDocument();
  });

  it('distinguishes a promoted lead from one created by hand', async () => {
    renderTimeline([
      makeActivity({ id: 1, activityType: 'lead_created' }),
      makeActivity({
        id: 2,
        activityType: 'lead_created',
        metadata: { prospectId: 30 },
      }),
    ]);

    expect(await screen.findByText('created this lead')).toBeInTheDocument();
    expect(
      screen.getByText('created this lead from a promoted prospect'),
    ).toBeInTheDocument();
  });

  it('renders "converted this lead to a deal" for lead_converted', async () => {
    renderTimeline([
      makeActivity({
        activityType: 'lead_converted',
        metadata: { dealId: 9 },
      }),
    ]);
    expect(
      await screen.findByText('converted this lead to a deal'),
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
    expect(
      screen.getByText('moved deal from Prospecting to Proposal'),
    ).toBeInTheDocument();
    expect(screen.getByText('linked company Acme Corp')).toBeInTheDocument();
  });
});

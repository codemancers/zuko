/**
 * @vitest-environment jsdom
 *
 * Reaching a lead from its campaign group. Clicking a row used to push
 * /leads/campaign/<campaignId>/<leadId>, a route that does not exist, and the
 * uncampaigned group resolved its id to NaN — which the API client dropped, so
 * the group listed every lead in the organization.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LeadsInList from '@/components/Leads/LeadsInList';
import type { Lead } from '@/lib/api/leads';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockList = vi.fn();
vi.mock('@/lib/api/leads', () => ({
  leadsApi: {
    list: (...args: unknown[]) => mockList(...args),
    convert: vi.fn(),
    revert: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
  },
}));

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 25,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    status: 'replied',
    source: 'manual',
    createdAt: new Date().toISOString(),
    ...overrides,
  } as Lead;
}

function renderList(props: { campaignId?: number; uncampaigned?: boolean }) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <LeadsInList {...props} />
    </QueryClientProvider>,
  );
}

describe('LeadsInList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({
      data: [lead()],
      total: 1,
      page: 1,
      perPage: 50,
      totalPages: 1,
    });
  });

  it('opens the lead detail page when a row is clicked', async () => {
    const user = userEvent.setup();
    renderList({ campaignId: 7 });

    // Not the name cell — that is a link of its own, which stops propagation.
    await user.click(await screen.findByText('ada@example.com'));

    expect(mockPush).toHaveBeenCalledWith('/leads/25');
  });

  it('links the name straight at the lead, not under its campaign', async () => {
    renderList({ campaignId: 7 });

    const link = await screen.findByRole('link', { name: 'Ada Lovelace' });
    expect(link).toHaveAttribute('href', '/leads/25');
  });

  it('asks for one campaign when it has one', async () => {
    renderList({ campaignId: 7 });

    await waitFor(() =>
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ campaignId: 7 }),
      ),
    );
    expect(mockList.mock.calls[0][0]).not.toHaveProperty('uncampaigned', true);
  });

  it('asks for the leads that belong to no campaign, never for all of them', async () => {
    renderList({ uncampaigned: true });

    await waitFor(() =>
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ uncampaigned: true }),
      ),
    );
    expect(mockList.mock.calls[0][0].campaignId).toBeUndefined();
    expect(await screen.findByText('Uncampaigned')).toBeInTheDocument();
  });
});

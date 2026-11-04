import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import SalesOverviewPage from '@/app/(app)/sales-overview/page';
import { SalesOverview } from '@/components/SalesOverview/SalesOverview';
import { SalesOverviewNavItem } from '@/components/SalesOverview/SalesOverviewNavItem';
import { ApiError } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
const state = vi.hoisted(() => ({
  allowed: true,
  loading: false,
  org: '7',
  get: vi.fn(),
}));
vi.mock('@/hooks/use-sales-overview-access', () => ({
  useSalesOverviewAccess: () => ({
    allowed: state.allowed,
    loading: state.loading,
  }),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: { useActiveOrganization: () => ({ data: { id: state.org } }) },
}));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClientModule>()),
  apiClient: { get: state.get },
}));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw Error(`redirect:${path}`);
  },
}));
beforeEach(() => {
  state.allowed = true;
  state.loading = false;
  state.org = '7';
  state.get.mockReset().mockResolvedValue({ organizationId: 7 });
});
describe('Sales Overview shell', () => {
  // Approved v12 prototype: two top panels, then a full-width activity table.
  it('preserves the approved panel grouping and five-column table', () => {
    render(<SalesOverview organizationId={7} />);
    const attention = screen.getByRole('region', { name: 'Needs attention' });
    const recent = screen.getByRole('region', { name: 'Recent work' });
    const ongoing = screen.getByRole('region', {
      name: 'Ongoing sales activities',
    });
    expect(attention.parentElement).toBe(recent.parentElement);
    expect(ongoing.parentElement).not.toBe(attention.parentElement);
    expect(
      screen.getAllByRole('columnheader').map((h) => h.textContent),
    ).toEqual([
      'Activity / campaign',
      'Channel',
      'Status',
      'Activity count',
      'Latest update',
    ]);
    expect(screen.getByRole('button', { name: 'Add task' })).toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: 'Recent work period' }),
    ).toHaveValue('yesterday');
  });
  it('hides sections from Members', () => {
    state.allowed = false;
    render(<SalesOverview organizationId={7} />);
    expect(
      screen.queryByRole('heading', { name: 'Needs attention' }),
    ).not.toBeInTheDocument();
  });
  it('hides sections during loading and organization switches', () => {
    state.org = '8';
    render(<SalesOverview organizationId={7} />);
    expect(
      screen.queryByRole('heading', { name: 'Needs attention' }),
    ).not.toBeInTheDocument();
  });
  it('shows navigation for eligible users', () => {
    render(<SalesOverviewNavItem collapsed={false} current={false} />);
    expect(
      screen.getByRole('link', { name: 'Sales Overview' }),
    ).toHaveAttribute('href', '/sales-overview');
  });
  it('hides navigation from Members', () => {
    state.allowed = false;
    render(<SalesOverviewNavItem collapsed={false} current={false} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
  it('validates the server request before rendering', async () => {
    render(await SalesOverviewPage());
    expect(state.get).toHaveBeenCalledWith('/sales-overview/access');
    expect(
      screen.getByRole('heading', { name: 'Needs attention' }),
    ).toBeInTheDocument();
  });
  it('does not render protected content on direct-route denial', async () => {
    state.get.mockRejectedValue(new ApiError('Forbidden', 403));
    render(await SalesOverviewPage());
    expect(
      screen.queryByRole('heading', { name: 'Needs attention' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Sales Overview is restricted'),
    ).toBeInTheDocument();
  });
  it('redirects unauthenticated visitors', async () => {
    state.get.mockRejectedValue(new ApiError('Unauthorized', 401));
    await expect(SalesOverviewPage()).rejects.toThrow('redirect:/sign-in');
  });
  it('shows an honest error instead of empty success on server failure', async () => {
    state.get.mockRejectedValue(new Error('Offline'));
    render(await SalesOverviewPage());
    expect(screen.getByText('Unable to verify access')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Needs attention' }),
    ).not.toBeInTheDocument();
  });
  it('renders the three named sections in order with no fake metrics', () => {
    render(<SalesOverview organizationId={7} />);
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
    ).toEqual(['Needs attention', 'Recent work', 'Ongoing sales activities']);
    expect(screen.queryByText('Basic results')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByText(/not connected yet/i)).toBeInTheDocument();
  });
});

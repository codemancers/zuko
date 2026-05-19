/**
 * @vitest-environment jsdom
 *
 * Unit tests for team management flows.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ─── Component imports ───────────────────────────────────────────────────────
import { CreateTeamDialog } from '@/components/organization/create-team-dialog';
import { OrgTeams } from '@/components/organization/org-teams';
import * as queryOptions from '@/server/query-options';

// ─── Mocks ───────────────────────────────────────────────────────────────────
const mockCreateTeam = vi.fn();
const mockUpdateTeam = vi.fn();
const mockRemoveTeam = vi.fn();

// Mock ResizeObserver which is missing in jsdom
global.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: vi.fn(() => ({ data: { user: { id: '1' } } })),
    organization: {
      createTeam: (...args: unknown[]) => mockCreateTeam(...args),
      updateTeam: (...args: unknown[]) => mockUpdateTeam(...args),
      removeTeam: (...args: unknown[]) => mockRemoveTeam(...args),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Stub query-options used inside components
vi.mock('@/server/query-options', () => ({
  getOrganizations: vi.fn(() => ({
    queryKey: ['organizations'],
    queryFn: async () => [],
  })),
  getTeams: vi.fn((orgId: string) => ({
    queryKey: ['organization', orgId, 'teams'],
    queryFn: async () => [],
  })),
  getTeamMembers: vi.fn((teamId: string) => ({
    queryKey: ['team', teamId, 'members'],
    queryFn: async () => [],
  })),
  getMembers: vi.fn((orgId: string) => ({
    queryKey: ['organization', orgId, 'members'],
    queryFn: async () => [],
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Providers({ children }: { children: React.ReactNode }) {
  const qc = React.useMemo(() => makeQueryClient(), []);
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function renderWithProviders(ui: React.ReactElement) {
  return render(ui, { wrapper: Providers });
}

// ─── CreateTeamDialog tests ──────────────────────────────────────────────────
describe('CreateTeamDialog', () => {
  const baseProps = {
    organizationId: 'org-1',
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog in create mode by default', () => {
    renderWithProviders(<CreateTeamDialog {...baseProps} />);
    // Use role heading to disambiguate from button
    expect(
      screen.getByRole('heading', { name: /create team/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/team name/i)).toBeInTheDocument();
  });

  it('renders the dialog in update mode when initialData is provided', () => {
    renderWithProviders(
      <CreateTeamDialog
        {...baseProps}
        initialData={{ id: 'team-1', name: 'Engineering' }}
      />,
    );
    expect(
      screen.getByRole('heading', { name: /update team/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/team name/i)).toHaveValue('Engineering');
  });

  it('calls createTeam when submitting in create mode', async () => {
    mockCreateTeam.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    renderWithProviders(<CreateTeamDialog {...baseProps} />);

    await user.type(screen.getByLabelText(/team name/i), 'Dev Team');
    await user.click(screen.getByRole('button', { name: /^create team$/i }));

    await waitFor(() => {
      expect(mockCreateTeam).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Dev Team',
          organizationId: 'org-1',
        }),
      );
    });
  });

  it('calls updateTeam when submitting in update mode', async () => {
    mockUpdateTeam.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    renderWithProviders(
      <CreateTeamDialog
        {...baseProps}
        initialData={{ id: 'team-1', name: 'Engineering' }}
      />,
    );

    await user.clear(screen.getByLabelText(/team name/i));
    await user.type(screen.getByLabelText(/team name/i), 'Product');
    await user.click(screen.getByRole('button', { name: /^update team$/i }));

    await waitFor(() => {
      expect(mockUpdateTeam).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: 'team-1',
          data: { name: 'Product' },
        }),
      );
    });
  });
});

// ─── OrgTeams tests ──────────────────────────────────────────────────────────
describe('OrgTeams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderWithTeams(teams: any[]) {
    vi.mocked(queryOptions.getOrganizations).mockReturnValue({
      queryKey: ['organizations'],
      queryFn: async () => [{ id: 'org-1', slug: 'my-org', name: 'My Org' }],
    } as any);
    vi.mocked(queryOptions.getTeams).mockReturnValue({
      queryKey: ['organization', 'org-1', 'teams'],
      queryFn: async () => teams,
    } as any);
    return renderWithProviders(<OrgTeams slug="my-org" />);
  }

  it('renders a table with teams', async () => {
    renderWithTeams([
      {
        id: 'team-1',
        name: 'Engineering',
        createdAt: new Date().toISOString(),
      },
      { id: 'team-2', name: 'Marketing', createdAt: new Date().toISOString() },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Engineering')).toBeInTheDocument();
      expect(screen.getByText('Marketing')).toBeInTheDocument();
    });
  });

  it('shows empty state when no teams found', async () => {
    renderWithTeams([]);
    await waitFor(() => {
      expect(screen.getByText('No teams yet')).toBeInTheDocument();
    });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /add row/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /new team/i }),
    ).toBeInTheDocument();
  });

  it('opens a sheet and creates a team from the empty state', async () => {
    mockCreateTeam.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    renderWithTeams([]);

    await user.click(await screen.findByRole('button', { name: /new team/i }));
    expect(
      screen.getByRole('heading', { name: /new team/i }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/team name/i), 'Sales');
    await user.click(screen.getByRole('button', { name: /^create team$/i }));

    await waitFor(() => {
      expect(mockCreateTeam).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Sales',
          organizationId: 'org-1',
        }),
      );
    });
  });

  it('calls removeTeam when confirmed in delete alert', async () => {
    mockRemoveTeam.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    renderWithTeams([
      {
        id: 'team-1',
        name: 'Engineering',
        createdAt: new Date().toISOString(),
      },
    ]);

    await waitFor(() =>
      expect(screen.getByText('Engineering')).toBeInTheDocument(),
    );

    // Click Remove team icon button
    await user.click(screen.getByLabelText(/remove team/i));

    // Confirm in Alert
    expect(
      screen.getByText(
        /are you sure you want to remove the team "engineering"/i,
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^remove$/i }));

    await waitFor(() => {
      expect(mockRemoveTeam).toHaveBeenCalledWith({
        teamId: 'team-1',
        organizationId: 'org-1',
      });
    });
  });
});

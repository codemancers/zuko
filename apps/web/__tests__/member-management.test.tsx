/**
 * @vitest-environment jsdom
 *
 * Unit tests for member management flows.
 * Mirrors the E2E tests in apps/web-e2e/src/member-management.spec.ts, but
 * at the component level using mocked authClient calls.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ─── Component imports ───────────────────────────────────────────────────────
import { AddMemberDialog } from '@/components/organization/add-member-dialog';
import { UserInvitations } from '@/components/organization/user-invitations';
import { RemoveFromTeamsDialog } from '@/components/organization/remove-from-teams-dialog';
import * as queryOptions from '@/server/query-options';

// ─── Mocks ───────────────────────────────────────────────────────────────────
const mockInviteMember = vi.fn();
const mockAcceptInvitation = vi.fn();
const mockRejectInvitation = vi.fn();
const mockRemoveTeamMember = vi.fn();
const mockRemoveMember = vi.fn();
const mockSetActive = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    organization: {
      inviteMember: (...args: unknown[]) => mockInviteMember(...args),
      acceptInvitation: (...args: unknown[]) => mockAcceptInvitation(...args),
      rejectInvitation: (...args: unknown[]) => mockRejectInvitation(...args),
      removeTeamMember: (...args: unknown[]) => mockRemoveTeamMember(...args),
      removeMember: (...args: unknown[]) => mockRemoveMember(...args),
      setActive: (...args: unknown[]) => mockSetActive(...args),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Stub query-options used inside components
vi.mock('@/server/query-options', () => ({
  getUserInvitations: vi.fn(() => ({
    queryKey: ['user', 'invitations'],
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
  getOrganizations: vi.fn(() => ({
    queryKey: ['organizations'],
    queryFn: async () => [],
  })),
  getMembers: vi.fn((orgId: string) => ({
    queryKey: ['organization', orgId, 'members'],
    queryFn: async () => [],
  })),
  getInvitations: vi.fn((orgId: string) => ({
    queryKey: ['organization', orgId, 'invitations'],
    queryFn: async () => [],
  })),
}));

// Stub window.location.reload used by UserInvitations after accepting
Object.defineProperty(window, 'location', {
  value: { ...window.location, reload: vi.fn() },
  writable: true,
});

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

// ─── AddMemberDialog tests ────────────────────────────────────────────────────
describe('AddMemberDialog — invite flow', () => {
  const baseProps = {
    organizationId: 'org-1',
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog with email input and Send Invitation button', () => {
    renderWithProviders(<AddMemberDialog {...baseProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /send invitation/i }),
    ).toBeInTheDocument();
  });

  it('calls inviteMember with the typed email on submit', async () => {
    mockInviteMember.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    renderWithProviders(<AddMemberDialog {...baseProps} />);

    await user.type(
      screen.getByLabelText(/email address/i),
      'newuser@example.com',
    );
    await user.click(screen.getByRole('button', { name: /send invitation/i }));

    await waitFor(() => {
      expect(mockInviteMember).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'newuser@example.com',
          organizationId: 'org-1',
        }),
      );
    });
  });

  it('calls onSuccess and onClose after a successful invite', async () => {
    mockInviteMember.mockResolvedValue({ error: null });
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <AddMemberDialog
        {...baseProps}
        onSuccess={onSuccess}
        onClose={onClose}
      />,
    );

    await user.type(screen.getByLabelText(/email address/i), 'x@test.com');
    await user.click(screen.getByRole('button', { name: /send invitation/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows loading state while the invite is in-flight', async () => {
    let resolve: (v: unknown) => void;
    mockInviteMember.mockImplementation(
      () => new Promise((res) => (resolve = res)),
    );
    const user = userEvent.setup();

    renderWithProviders(<AddMemberDialog {...baseProps} />);

    await user.type(screen.getByLabelText(/email address/i), 'x@test.com');
    await user.click(screen.getByRole('button', { name: /send invitation/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /sending\.\.\./i }),
      ).toBeDisabled();
    });

    resolve!({ error: null });
  });

  it('shows an error message when the invite fails', async () => {
    mockInviteMember.mockResolvedValue({
      error: { message: 'User already a member' },
    });
    const user = userEvent.setup();

    renderWithProviders(<AddMemberDialog {...baseProps} />);

    await user.type(screen.getByLabelText(/email address/i), 'x@test.com');
    await user.click(screen.getByRole('button', { name: /send invitation/i }));

    await waitFor(() => {
      expect(screen.getByText(/user already a member/i)).toBeInTheDocument();
    });
  });

  it('calls onClose when Cancel is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AddMemberDialog {...baseProps} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

// ─── UserInvitations tests ────────────────────────────────────────────────────
describe('UserInvitations — accept / decline flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderWithInvitations(
    invitations: {
      id: string;
      organizationId: string;
      organizationName: string;
      role: string;
    }[],
  ) {
    vi.mocked(queryOptions.getUserInvitations).mockReturnValue({
      queryKey: ['user', 'invitations'],
      queryFn: async () => invitations,
    } as never);
    return renderWithProviders(<UserInvitations />);
  }

  it('shows empty state when there are no invitations', async () => {
    renderWithInvitations([]);
    await waitFor(() => {
      expect(screen.getByText(/no invitations/i)).toBeInTheDocument();
    });
  });

  it("renders each invitation's organization name and role", async () => {
    renderWithInvitations([
      {
        id: 'inv-1',
        organizationId: 'org-1',
        organizationName: 'Acme Corp',
        role: 'member',
      },
    ]);
    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText(/member/i)).toBeInTheDocument();
    });
  });

  it('shows Accept and Decline buttons for each invitation', async () => {
    renderWithInvitations([
      {
        id: 'inv-1',
        organizationId: 'org-1',
        organizationName: 'Acme Corp',
        role: 'member',
      },
    ]);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /accept/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /decline/i }),
      ).toBeInTheDocument();
    });
  });

  it('calls acceptInvitation when Accept is clicked', async () => {
    mockAcceptInvitation.mockResolvedValue({ error: null });
    mockSetActive.mockResolvedValue({});
    const user = userEvent.setup();

    renderWithInvitations([
      {
        id: 'inv-1',
        organizationId: 'org-1',
        organizationName: 'Acme Corp',
        role: 'member',
      },
    ]);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /accept/i }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /accept/i }));

    await waitFor(() => {
      expect(mockAcceptInvitation).toHaveBeenCalledWith({
        invitationId: 'inv-1',
      });
    });
  });

  it('calls rejectInvitation when Decline is clicked', async () => {
    mockRejectInvitation.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    renderWithInvitations([
      {
        id: 'inv-1',
        organizationId: 'org-1',
        organizationName: 'Acme Corp',
        role: 'member',
      },
    ]);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /decline/i }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /decline/i }));

    await waitFor(() => {
      expect(mockRejectInvitation).toHaveBeenCalledWith({
        invitationId: 'inv-1',
      });
    });
  });

  it('shows Accepting... state while the request is in-flight', async () => {
    let resolve: (v: unknown) => void;
    mockAcceptInvitation.mockImplementation(
      () => new Promise((res) => (resolve = res)),
    );
    const user = userEvent.setup();

    renderWithInvitations([
      {
        id: 'inv-1',
        organizationId: 'org-1',
        organizationName: 'Acme Corp',
        role: 'member',
      },
    ]);

    await waitFor(() =>
      expect(
        screen.getByLabelText(/accept invitation/i),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByLabelText(/accept invitation/i));

    await waitFor(() => {
      expect(
        screen.getByLabelText(/accept invitation/i),
      ).toBeDisabled();
    });

    resolve!({ error: null });
  });
});

// ─── RemoveFromTeamsDialog tests ──────────────────────────────────────────────
describe('RemoveFromTeamsDialog — remove from team flow', () => {
  const baseProps = {
    organizationId: 'org-1',
    userId: 'user-1',
    memberName: 'Alice',
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog with member name and Remove from Team button', () => {
    renderWithProviders(<RemoveFromTeamsDialog {...baseProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/alice/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /remove from team/i }),
    ).toBeInTheDocument();
  });

  it('shows "not in any teams" message when member has no teams', async () => {
    renderWithProviders(<RemoveFromTeamsDialog {...baseProps} />);
    await waitFor(() => {
      expect(
        screen.getByText(/this member is not in any teams/i),
      ).toBeInTheDocument();
    });
    // Remove button should be disabled
    expect(
      screen.getByRole('button', { name: /remove from team/i }),
    ).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <RemoveFromTeamsDialog {...baseProps} onClose={onClose} />,
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

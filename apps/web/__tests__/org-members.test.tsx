/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrgMembers } from '@/components/organization/org-members';
import { useQuery } from '@tanstack/react-query';

// Mock the UI kit components to avoid complex rendering issues in unit tests
vi.mock('@zuko/ui-kit', async () => {
  const actual = await vi.importActual('@zuko/ui-kit');
  return {
    ...actual,
    Avatar: ({ initials }: { initials: string }) => (
      <div data-testid="avatar">{initials}</div>
    ),
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('@/server/query-options', () => ({
  getOrganizations: vi.fn(() => ({ queryKey: ['organizations'] })),
  getMembers: vi.fn((id: string) => ({ queryKey: ['members', id] })),
}));

describe('OrgMembers Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state correctly', () => {
    vi.mocked(useQuery).mockReturnValue({
      isLoading: true,
      data: undefined,
    } as any);

    render(<OrgMembers slug="test-org" />);
    expect(screen.getByText(/loading members/i)).toBeInTheDocument();
  });

  it('renders error state when organization is not found', () => {
    vi.mocked(useQuery).mockReturnValue({
      isLoading: false,
      data: [], // No organizations found
    } as any);

    render(<OrgMembers slug="non-existent" />);
    expect(screen.getByText(/organization not found/i)).toBeInTheDocument();
  });

  it('renders empty members list correctly', () => {
    // First call for organizations
    vi.mocked(useQuery).mockReturnValueOnce({
      isLoading: false,
      data: [{ id: 'org-1', name: 'Test Org', slug: 'test-org' }],
    } as any);
    // Second call for members
    vi.mocked(useQuery).mockReturnValueOnce({
      isLoading: false,
      data: [],
    } as any);

    render(<OrgMembers slug="test-org" />);
    expect(
      screen.getByText(/manage who has access to test org/i).closest('div'),
    ).toBeInTheDocument();
    expect(screen.getByText(/no members found/i)).toBeInTheDocument();
  });

  it('renders members list correctly', () => {
    const mockMembers = [
      {
        id: 'm1',
        role: 'owner',
        user: { id: 'u1', name: 'User One', email: 'user1@example.com' },
      },
      {
        id: 'm2',
        role: 'member',
        user: { id: 'u2', name: null, email: 'user2@example.com' },
      },
    ];

    vi.mocked(useQuery).mockImplementation((options: any) => {
      if (options.queryKey[0] === 'organizations') {
        return {
          isLoading: false,
          data: [{ id: 'org-1', name: 'Test Org', slug: 'test-org' }],
        } as any;
      }
      return {
        isLoading: false,
        data: mockMembers,
      } as any;
    });

    render(<OrgMembers slug="test-org" />);

    expect(screen.getByText('User One')).toBeInTheDocument();
    expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    expect(screen.getByText('owner', { selector: 'span' })).toBeInTheDocument();

    expect(screen.getAllByText('user2@example.com')).toHaveLength(2);
    expect(
      screen.getByText('member', { selector: 'span' }),
    ).toBeInTheDocument();

    const avatars = screen.getAllByTestId('avatar');
    expect(avatars).toHaveLength(2);
    expect(avatars[0].textContent).toBe('UO');
  });

  it('hides header when hideHeader prop is true', () => {
    vi.mocked(useQuery).mockImplementation((options: any) => {
      if (options.queryKey[0] === 'organizations') {
        return {
          isLoading: false,
          data: [{ id: 'org-1', name: 'Test Org', slug: 'test-org' }],
        } as any;
      }
      return {
        isLoading: false,
        data: [],
      } as any;
    });

    render(<OrgMembers slug="test-org" hideHeader={true} />);

    expect(screen.queryByText(/back to test org/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Members', { selector: 'h1' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /invite member/i }),
    ).toBeInTheDocument();
  });
});

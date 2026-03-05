/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrgTeams } from '@/components/organization/org-teams';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/server/query-options', () => ({
  getOrganizations: vi.fn(() => ({ queryKey: ['organizations'] })),
  getTeams: vi.fn((id: string) => ({ queryKey: ['teams', id] })),
}));

describe('OrgTeams Component', () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
    } as any);
  });

  it('renders loading state correctly', () => {
    vi.mocked(useQuery).mockReturnValue({
      isLoading: true,
      data: undefined,
    } as any);

    render(<OrgTeams slug="test-org" />);
    expect(screen.getByText(/loading teams/i)).toBeInTheDocument();
  });

  it('renders error state when organization is not found', () => {
    vi.mocked(useQuery).mockReturnValue({
      isLoading: false,
      data: [],
    } as any);

    render(<OrgTeams slug="non-existent" />);
    expect(screen.getByText(/organization not found/i)).toBeInTheDocument();
  });

  it('renders empty teams list correctly', () => {
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

    render(<OrgTeams slug="test-org" />);
    expect(
      screen.getByText(/manage teams within test org/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/no teams found/i)).toBeInTheDocument();
  });

  it('renders teams list correctly', () => {
    const mockTeams = [
      {
        id: 't1',
        name: 'Engineering',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 't2',
        name: 'Design',
        createdAt: '2024-01-02T00:00:00.000Z',
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
        data: mockTeams,
      } as any;
    });

    render(<OrgTeams slug="test-org" />);

    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('Design')).toBeInTheDocument();
    expect(screen.getByText(/created on 1\/1\/2024/i)).toBeInTheDocument();
  });

  it('navigates to create team page when button is clicked', () => {
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

    render(<OrgTeams slug="test-org" />);

    const createButton = screen.getByRole('button', { name: /create team/i });
    fireEvent.click(createButton);

    expect(mockPush).toHaveBeenCalledWith('/organization/test-org/teams/new');
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

    render(<OrgTeams slug="test-org" hideHeader={true} />);

    expect(screen.queryByText(/back to test org/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Teams', { selector: 'h1' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create team/i }),
    ).toBeInTheDocument();
  });
});

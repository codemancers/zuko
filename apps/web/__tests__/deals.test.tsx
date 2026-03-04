/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DealForm from '@/components/Deals/DealForm';
import DealsList, { EmptyDealsList } from '@/components/Deals/DealsList';
import DealDetail from '@/components/Deals/DealDetail';
import type { Deal } from '@/lib/api/deals';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockCreateDeal = vi.fn();
const mockUpdateDeal = vi.fn();
const mockGetDeals = vi.fn();
const mockGetDeal = vi.fn();
const mockHideDeal = vi.fn();
const mockRemoveCompany = vi.fn();
const mockUpdateCompany = vi.fn();
const mockRemoveContact = vi.fn();
const mockUpdateContact = vi.fn();
vi.mock('@/lib/api/deals', () => ({
  dealsApi: {
    createDeal: (...args: unknown[]) => mockCreateDeal(...args),
    updateDeal: (...args: unknown[]) => mockUpdateDeal(...args),
    getDeals: (...args: unknown[]) => mockGetDeals(...args),
    getDeal: (...args: unknown[]) => mockGetDeal(...args),
    hideDeal: (...args: unknown[]) => mockHideDeal(...args),
    removeCompany: (...args: unknown[]) => mockRemoveCompany(...args),
    updateCompany: (...args: unknown[]) => mockUpdateCompany(...args),
    removeContact: (...args: unknown[]) => mockRemoveContact(...args),
    updateContact: (...args: unknown[]) => mockUpdateContact(...args),
  },
}));

vi.mock('@/components/Activity/ActivityTimeline', () => ({
  default: () => <div data-testid="activity-timeline">Activity</div>,
}));

vi.mock('@/components/Deals/AddCompanyToDealDialog', () => ({
  default: () => <div data-testid="add-company-dialog">Add Company</div>,
}));

vi.mock('@/components/Deals/AddContactToDealDialog', () => ({
  default: () => <div data-testid="add-contact-dialog">Add Contact</div>,
}));

const CURRENT_USER_ID = 1;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

describe('DealForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form with key fields', () => {
    render(<DealForm mode="create" currentUserId={CURRENT_USER_ID} />, {
      wrapper,
    });
    expect(screen.getByLabelText(/deal title \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/deal value/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/stage \*/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/win probability/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create deal/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows Create Deal in create mode and Save Changes in edit mode', () => {
    render(<DealForm mode="create" currentUserId={CURRENT_USER_ID} />, {
      wrapper,
    });
    expect(
      screen.getByRole('button', { name: /create deal/i })
    ).toBeInTheDocument();

    render(
      <DealForm
        mode="edit"
        currentUserId={CURRENT_USER_ID}
        deal={{
          id: 1,
          title: 'Deal A',
          stage: 'prospecting',
          isHidden: false,
          createdAt: '',
          updatedAt: '',
          owners: [],
        }}
      />,
      { wrapper }
    );
    expect(
      screen.getByRole('button', { name: /save changes/i })
    ).toBeInTheDocument();
  });

  it('prefills fields when editing', () => {
    render(
      <DealForm
        mode="edit"
        currentUserId={CURRENT_USER_ID}
        deal={{
          id: 1,
          title: 'Big Deal',
          value: 50000,
          currency: 'EUR',
          probability: 75,
          stage: 'negotiation',
          summary: 'Notes',
          expectedCloseDate: '2025-06-01',
          source: 'Referral',
          priority: 1,
          isHidden: false,
          createdAt: '',
          updatedAt: '',
          owners: [],
        }}
      />,
      { wrapper }
    );
    expect(screen.getByDisplayValue('Big Deal')).toBeInTheDocument();
    expect(screen.getByDisplayValue('50000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('75')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Notes')).toBeInTheDocument();
  });

  it('shows title required and does not submit', async () => {
    const user = userEvent.setup();
    render(<DealForm mode="create" currentUserId={CURRENT_USER_ID} />, {
      wrapper,
    });
    await user.click(screen.getByRole('button', { name: /create deal/i }));
    expect(
      screen.getByText(/deal title is required/i)
    ).toBeInTheDocument();
    expect(mockCreateDeal).not.toHaveBeenCalled();
  });

  it('shows value validation error for negative number', async () => {
    const user = userEvent.setup();
    render(<DealForm mode="create" currentUserId={CURRENT_USER_ID} />, {
      wrapper,
    });
    await user.type(
      screen.getByPlaceholderText(/enterprise license agreement/i),
      'Deal'
    );
    await user.type(screen.getByPlaceholderText(/100000/i), '-100');
    await user.click(screen.getByRole('button', { name: /create deal/i }));
    expect(
      screen.getByText(/value must be a positive number/i)
    ).toBeInTheDocument();
    expect(mockCreateDeal).not.toHaveBeenCalled();
  });

  it('calls createDeal and redirects on valid submit', async () => {
    mockCreateDeal.mockResolvedValue({ id: 1 });
    const user = userEvent.setup();
    render(<DealForm mode="create" currentUserId={CURRENT_USER_ID} />, {
      wrapper,
    });
    await user.type(
      screen.getByPlaceholderText(/enterprise license agreement/i),
      'New Deal'
    );
    await user.click(screen.getByRole('button', { name: /create deal/i }));

    await waitFor(() => {
      expect(mockCreateDeal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Deal',
          stage: 'prospecting',
          ownerIds: [CURRENT_USER_ID],
          primaryOwnerId: CURRENT_USER_ID,
        })
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/deals');
    });
  });

  it('calls updateDeal and redirects on valid submit in edit mode', async () => {
    mockUpdateDeal.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <DealForm
        mode="edit"
        currentUserId={CURRENT_USER_ID}
        deal={{
          id: 42,
          title: 'Old Title',
          stage: 'prospecting',
          isHidden: false,
          createdAt: '',
          updatedAt: '',
          owners: [],
        }}
      />,
      { wrapper }
    );
    await user.clear(screen.getByDisplayValue('Old Title'));
    await user.type(
      screen.getByPlaceholderText(/enterprise license agreement/i),
      'Updated Title'
    );
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateDeal).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ title: 'Updated Title' })
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/deals/42');
    });
  });

  it('navigates to deals list on Cancel in create mode', async () => {
    const user = userEvent.setup();
    render(<DealForm mode="create" currentUserId={CURRENT_USER_ID} />, {
      wrapper,
    });
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockPush).toHaveBeenCalledWith('/deals');
  });

  it('navigates to deal detail on Cancel in edit mode', async () => {
    const user = userEvent.setup();
    render(
      <DealForm
        mode="edit"
        currentUserId={CURRENT_USER_ID}
        deal={{
          id: 10,
          title: 'X',
          stage: 'prospecting',
          isHidden: false,
          createdAt: '',
          updatedAt: '',
          owners: [],
        }}
      />,
      { wrapper }
    );
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockPush).toHaveBeenCalledWith('/deals/10');
  });

  it('shows submit error when create fails', async () => {
    mockCreateDeal.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    render(<DealForm mode="create" currentUserId={CURRENT_USER_ID} />, {
      wrapper,
    });
    await user.type(
      screen.getByPlaceholderText(/enterprise license agreement/i),
      'Fail Deal'
    );
    await user.click(screen.getByRole('button', { name: /create deal/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/server error|failed to create deal/i)
      ).toBeInTheDocument();
    });
  });

  it('shows Saving... while submitting', async () => {
    let resolveCreate: (value: unknown) => void = () => {
      /* noop until Promise constructor runs */
    };
    mockCreateDeal.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );
    const user = userEvent.setup();
    render(<DealForm mode="create" currentUserId={CURRENT_USER_ID} />, {
      wrapper,
    });
    await user.type(
      screen.getByPlaceholderText(/enterprise license agreement/i),
      'Slow Deal'
    );
    await user.click(screen.getByRole('button', { name: /create deal/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /saving/i })
      ).toBeInTheDocument();
    });
    if (resolveCreate) resolveCreate({ id: 1 });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/deals');
    });
  });
});

const emptyDealsResponse = {
  deals: [],
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
};

const mockDeal = {
  id: 1,
  title: 'Enterprise Deal',
  value: 100000,
  currency: 'USD',
  probability: 70,
  stage: 'negotiation',
  summary: undefined,
  expectedCloseDate: '2025-12-31',
  source: 'Inbound',
  priority: 1,
  isHidden: false,
  createdAt: '2025-01-15T00:00:00Z',
  updatedAt: '2025-01-15T00:00:00Z',
  owners: [
    {
      id: 1,
      userId: 1,
      dealId: 1,
      isPrimary: true,
      assignedAt: '',
      user: { id: 1, name: 'Alice', email: 'alice@example.com' },
    },
  ],
  companies: [],
  contacts: [],
};

describe('DealsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDeals.mockResolvedValue(emptyDealsResponse);
  });

  it('renders heading and description', () => {
    render(<DealsList />, { wrapper });
    expect(screen.getByText('Deals')).toBeInTheDocument();
    expect(
      screen.getByText(/manage your sales pipeline and track deal progress/i)
    ).toBeInTheDocument();
  });

  it('renders search and New Deal button', () => {
    render(<DealsList />, { wrapper });
    expect(
      screen.getByPlaceholderText(
        /search deals by title, summary, or source/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /new deal/i })
    ).toBeInTheDocument();
  });

  it('New Deal button navigates to /deals/new', async () => {
    const user = userEvent.setup();
    render(<DealsList />, { wrapper });
    await user.click(screen.getByRole('button', { name: /new deal/i }));
    expect(mockPush).toHaveBeenCalledWith('/deals/new');
  });

  it('shows empty state when no deals', async () => {
    render(<DealsList />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('No Deals')).toBeInTheDocument();
    });
  });

  it('shows table with deal when data is returned', async () => {
    mockGetDeals.mockResolvedValue({
      deals: [mockDeal],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    render(<DealsList />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Enterprise Deal')).toBeInTheDocument();
    });
    expect(screen.getByText(/\$100,000/)).toBeInTheDocument();
    expect(screen.getByText(/negotiation/i)).toBeInTheDocument();
    expect(screen.getByText(/70%/)).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('navigates to deal detail when row is clicked', async () => {
    mockGetDeals.mockResolvedValue({
      deals: [mockDeal],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    const user = userEvent.setup();
    render(<DealsList />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Enterprise Deal')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Enterprise Deal'));
    expect(mockPush).toHaveBeenCalledWith('/deals/1');
  });

  it('shows loading state', () => {
    mockGetDeals.mockImplementation(
      () => new Promise<never>(() => undefined)
    );
    render(<DealsList />, { wrapper });
    expect(screen.getByText(/loading deals/i)).toBeInTheDocument();
  });

  it('calls getDeals with search when user types', async () => {
    const user = userEvent.setup();
    render(<DealsList />, { wrapper });
    const search = screen.getByPlaceholderText(
      /search deals by title, summary, or source/i
    );
    await user.type(search, 'enterprise');
    await waitFor(() => {
      expect(mockGetDeals).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'enterprise' })
      );
    });
  });

  it('shows pagination text', async () => {
    mockGetDeals.mockResolvedValue({
      deals: [mockDeal],
      pagination: { page: 1, limit: 10, total: 50, totalPages: 5 },
    });
    render(<DealsList />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Enterprise Deal')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/showing 1 of 50 deals/i)
    ).toBeInTheDocument();
  });
});

describe('DealDetail', () => {
  const detailDeal = {
    id: 7,
    title: 'Detail Deal',
    value: 25000,
    currency: 'EUR',
    probability: 50,
    stage: 'proposal',
    summary: 'Deal summary',
    expectedCloseDate: '2025-06-15',
    source: 'Referral',
    priority: 2,
    isHidden: false,
    createdAt: '2025-01-10T12:00:00Z',
    updatedAt: '2025-01-15T14:00:00Z',
    owners: [
      {
        id: 1,
        userId: 1,
        dealId: 7,
        isPrimary: true,
        assignedAt: '',
        user: { id: 1, name: 'Alice', email: 'alice@example.com' },
      },
    ],
    companies: [],
    contacts: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDeal.mockResolvedValue(detailDeal);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('shows loading state', () => {
    mockGetDeal.mockImplementation(
      () => new Promise<never>(() => undefined)
    );
    render(<DealDetail dealId={7} currentUserId={1} />, { wrapper });
    expect(screen.getByText(/loading deal/i)).toBeInTheDocument();
  });

  it('shows deal not found when getDeal returns no data', async () => {
    mockGetDeal.mockResolvedValue(null as unknown as Deal);
    render(<DealDetail dealId={999} currentUserId={1} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText(/deal not found/i)).toBeInTheDocument();
    });
  });

  it('renders deal title and details when loaded', async () => {
    render(<DealDetail dealId={7} currentUserId={1} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Detail Deal')).toBeInTheDocument();
    });
    expect(screen.getByText('Deal summary')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('navigates to edit when Edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<DealDetail dealId={7} currentUserId={1} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Detail Deal')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(mockPush).toHaveBeenCalledWith('/deals/7/edit');
  });

  it('calls hideDeal and redirects when Hide is confirmed', async () => {
    mockHideDeal.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DealDetail dealId={7} currentUserId={1} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Detail Deal')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /^hide$/i }));
    expect(mockHideDeal).toHaveBeenCalledWith(7);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/deals');
    });
  });

  it('does not call hideDeal when user cancels confirm', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const user = userEvent.setup();
    render(<DealDetail dealId={7} currentUserId={1} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Detail Deal')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /^hide$/i }));
    expect(mockHideDeal).not.toHaveBeenCalled();
  });
});

describe('EmptyDealsList', () => {
  it('renders empty state message', () => {
    render(<EmptyDealsList />);
    expect(screen.getByText('No Deals')).toBeInTheDocument();
    expect(
      screen.getByText(/get started by creating a new deal/i)
    ).toBeInTheDocument();
  });

  it('renders New Deal button/link', () => {
    render(<EmptyDealsList />);
    const link = screen.getByRole('link', { name: /new deal/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/deals/new');
  });
});

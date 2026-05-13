/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DealsList from '@/components/Deals/DealsList';
import DealDetail from '@/components/Deals/DealDetail';
import type { Deal } from '@/lib/api/deals';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, onClick }: any) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
        mockPush(href);
      }}
    >
      {children}
    </a>
  ),
}));

const mockCreateDeal = vi.fn();
const mockUpdateDeal = vi.fn();
const mockGetDeals = vi.fn();
const mockGetTableViewDeals = vi.fn();
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
    getTableViewDeals: (...args: unknown[]) => mockGetTableViewDeals(...args),
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

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: vi.fn(() => ({ data: { user: { id: '1' } } })),
  },
}));

vi.mock('@/lib/api/metadata', () => ({
  metadataApi: {
    getCurrencies: vi.fn(() =>
      Promise.resolve([
        { code: 'USD', symbol: '$', name: 'US Dollar' },
        { code: 'EUR', symbol: '€', name: 'Euro' },
      ]),
    ),
    getDealPriorities: vi.fn(() =>
      Promise.resolve([
        { value: 1, label: 'Low' },
        { value: 2, label: 'Medium' },
        { value: 3, label: 'High' },
      ]),
    ),
    getDealStages: vi.fn(() =>
      Promise.resolve([
        { value: 'prospecting', label: 'Prospecting' },
        { value: 'qualification', label: 'Qualification' },
        { value: 'proposal', label: 'Proposal' },
        { value: 'negotiation', label: 'Negotiation' },
        { value: 'closed_won', label: 'Closed Won' },
        { value: 'closed_lost', label: 'Closed Lost' },
      ]),
    ),
  },
}));

// Render ErrorMessage/Description as plain elements to avoid HeadlessUI context errors
vi.mock('@zuko/ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@zuko/ui-kit')>();
  return {
    ...actual,
    ErrorMessage: ({
      children,
      className,
    }: React.PropsWithChildren<{ className?: string }>) =>
      React.createElement(
        'p',
        { className: `error-message ${className ?? ''}`.trim() },
        children,
      ),
    Description: ({
      children,
      className,
    }: React.PropsWithChildren<{ className?: string }>) =>
      React.createElement(
        'p',
        { className: `description ${className ?? ''}`.trim() },
        children,
      ),
    Combobox: ({ options, onChange, placeholder, value }: any) => (
      <select
        value={
          value
            ? typeof value === 'object'
              ? (value.value ?? value.code ?? '')
              : value
            : ''
        }
        onChange={(e) => {
          const selected = options.find(
            (o: any) => String(o.value ?? o.code ?? o) === e.target.value,
          );
          if (selected) onChange(selected);
        }}
        aria-label={placeholder}
      >
        <option value="">{placeholder}</option>
        {options.map((o: any) => (
          <option key={o.value ?? o.code ?? o} value={o.value ?? o.code ?? o}>
            {o.label ?? o.code ?? String(o)}
          </option>
        ))}
      </select>
    ),
    ComboboxOption: ({ children }: any) => <>{children}</>,
    ComboboxLabel: ({ children }: any) => <>{children}</>,
    ComboboxDescription: ({ children }: any) => <>{children}</>,
  };
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const mockMetadata = [
  {
    id: 'title',
    header: 'Title',
    fieldType: 'entity',
    dataType: 'text',
    sortable: true,
    filterable: true,
    searchable: true,
    editable: true,
    isVisible: true,
    default: true,
    config: {
      entityType: 'deal',
      hrefTemplate: '/deals/{id}',
    },
  },
  {
    id: 'value',
    header: 'Value',
    fieldType: 'currency',
    dataType: 'number',
    sortable: true,
    filterable: true,
    searchable: true,
    editable: true,
    isVisible: true,
    default: true,
    config: {
      currency: 'USD',
      format: 'currency',
    },
  },
  {
    id: 'stage',
    header: 'Stage',
    fieldType: 'select',
    dataType: 'text',
    sortable: true,
    filterable: true,
    searchable: true,
    editable: true,
    isVisible: true,
    default: true,
    config: {
      render: 'badge',
      format: 'stage',
      options: [
        { label: 'Negotiation', value: 'negotiation' },
        { label: 'Proposal', value: 'proposal' },
        { label: 'Qualification', value: 'qualification' },
        { label: 'Prospecting', value: 'prospecting' },
        { label: 'Closed Won', value: 'closed_won' },
        { label: 'Closed Lost', value: 'closed_lost' },
      ],
      colorMap: {
        prospecting: 'zinc',
        qualification: 'blue',
        proposal: 'yellow',
        negotiation: 'yellow',
        closed_won: 'green',
        closed_lost: 'red',
      },
    },
  },
  {
    id: 'probability',
    header: 'Probability',
    fieldType: 'number',
    dataType: 'number',
    sortable: true,
    filterable: true,
    searchable: true,
    editable: true,
    isVisible: true,
    default: true,
    config: {
      accessorKey: 'probability',
    },
  },
  {
    id: 'owners',
    header: 'Owner',
    fieldType: 'text',
    dataType: 'json',
    sortable: false,
    filterable: true,
    searchable: true,
    editable: false,
    isVisible: true,
    default: true,
    config: {
      format: 'owner',
    },
  },
  {
    id: 'expectedCloseDate',
    header: 'Expected Close',
    fieldType: 'date',
    dataType: 'date',
    sortable: true,
    filterable: true,
    searchable: true,
    editable: false,
    isVisible: true,
    default: true,
    config: {
      format: 'date',
    },
  },
];

const emptyDealsResponse = {
  data: [],
  metadata: mockMetadata,
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
};

const mockDeal = {
  id: 1,
  organizationId: 1,
  title: 'Enterprise Deal',
  value: {
    value: '100000',
    display: '$100,000',
  },
  currency: 'USD',
  probability: 70,
  stage: {
    value: 'negotiation',
    display: 'Negotiation',
  },
  summary: 'Deal summary',
  expectedCloseDate: {
    value: '2025-12-31T00:00:00.000Z',
    display: '31 Dec 2025',
  },
  actualCloseDate: null,
  lostReason: null,
  source: 'Inbound',
  priority: 1,
  isHidden: false,
  createdAt: '2025-01-15T00:00:00Z',
  updatedAt: '2025-01-15T00:00:00Z',
  owners: {
    value: {
      id: 1,
      dealId: 1,
      userId: 1,
      isPrimary: true,
      assignedAt: '2025-01-15T00:00:00Z',
      user: { id: 1, name: 'Alice', email: 'alice@example.com' },
    },
    display: 'Alice',
  },
  companies: [],
  _count: {
    companies: 0,
    contacts: 0,
  },
};

describe('DealsList', () => {
  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
    mockGetTableViewDeals.mockResolvedValue(emptyDealsResponse);
  });

  it('renders heading and description', () => {
    render(<DealsList />, { wrapper });
    expect(screen.getByText('Deals')).toBeInTheDocument();
    expect(
      screen.getByText(/manage your sales pipeline and track deal progress/i),
    ).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<DealsList />, { wrapper });
    expect(
      screen.getByPlaceholderText(/search deals by title, summary, or source/i),
    ).toBeInTheDocument();
  });

  it('renders empty table even when no deals', async () => {
    render(<DealsList />, { wrapper });
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
      // Headers should still be there
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Stage')).toBeInTheDocument();
    });

    // The table body should have no data rows
    const tbody = screen.getByRole('table').querySelector('tbody');
    expect(tbody?.children.length).toBe(0);

    // button with add row label should be present
    expect(
      screen.getByRole('button', { name: /add row/i }),
    ).toBeInTheDocument();
  });

  it('shows table with deal when data is returned', async () => {
    mockGetTableViewDeals.mockResolvedValue({
      data: [mockDeal],
      metadata: mockMetadata,
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    render(<DealsList />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Enterprise Deal')).toBeInTheDocument();
    });
    expect(screen.getByText(/\$100,000/)).toBeInTheDocument();
    expect(screen.getByText(/Negotiation/i)).toBeInTheDocument();
    expect(screen.getByText(/70/)).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('navigates to deal detail when deal title link is clicked', async () => {
    mockGetTableViewDeals.mockResolvedValue({
      data: [mockDeal],
      metadata: mockMetadata,
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    const user = userEvent.setup();
    render(<DealsList />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Enterprise Deal')).toBeInTheDocument();
    });
    // Click a deal title link cell to navigate to deal details page
    await user.click(screen.getByText('Enterprise Deal'));
    expect(mockPush).toHaveBeenCalledWith('/deals/1');
  });

  it('shows loading state', () => {
    mockGetTableViewDeals.mockImplementation(
      () => new Promise<never>(() => undefined),
    );
    render(<DealsList />, { wrapper });
    expect(screen.getByText(/loading deals/i)).toBeInTheDocument();
  });

  it('calls getDeals with search when user types', async () => {
    const user = userEvent.setup();
    render(<DealsList />, { wrapper });
    const search = screen.getByPlaceholderText(
      /search deals by title, summary, or source/i,
    );
    await user.type(search, 'enterprise');
    await waitFor(() => {
      expect(mockGetTableViewDeals).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'enterprise' }),
      );
    });
  });

  it('shows pagination text', async () => {
    mockGetTableViewDeals.mockResolvedValue({
      data: [mockDeal],
      metadata: mockMetadata,
      pagination: { page: 1, limit: 10, total: 50, totalPages: 5 },
    });
    render(<DealsList />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Enterprise Deal')).toBeInTheDocument();
    });
    expect(screen.getByText(/showing 1 of 50 deals/i)).toBeInTheDocument();
  });

  it('opens column creation modal when add column button is clicked', async () => {
    mockGetTableViewDeals.mockResolvedValue({
      data: [mockDeal],
      metadata: mockMetadata,
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    const user = userEvent.setup();
    render(<DealsList />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Enterprise Deal')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add column/i }));

    // Verify the dialog title and input fields
    expect(screen.getByText('Add new field')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Field name')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/unique column key/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Field Type')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create field/i }),
    ).toBeInTheDocument();
  });

  // creates new deal when click on add row
  it('creates new deal when add row is clicked', async () => {
    const user = userEvent.setup();
    mockCreateDeal.mockResolvedValue({ id: 99 });

    render(<DealsList />, { wrapper });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /add row/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add row/i }));

    await waitFor(() => {
      expect(mockCreateDeal).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Deal' }),
      );
    });
  });

  it('opens new deal sheet when "New Deal" button is clicked', async () => {
    const user = userEvent.setup();
    render(<DealsList />, { wrapper });
    await user.click(screen.getByRole('button', { name: /new deal/i }));
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /new deal/i }),
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
    queryClient = createQueryClient();
    vi.clearAllMocks();
    mockGetDeal.mockResolvedValue(detailDeal);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('shows loading state', () => {
    mockGetDeal.mockImplementation(() => new Promise<never>(() => undefined));
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

  it('calls hideDeal and redirects when Hide is confirmed', async () => {
    mockHideDeal.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DealDetail dealId={7} currentUserId={1} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Detail Deal')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /^hide$/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/are you sure you want to hide this deal/i),
      ).toBeInTheDocument(),
    );
    const hideButtons = screen.getAllByRole('button', { name: /^hide$/i });
    await user.click(hideButtons[hideButtons.length - 1]);
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

  it('opens edit sheet when "Edit" button is clicked', async () => {
    const user = userEvent.setup();
    render(<DealDetail dealId={7} currentUserId={1} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Detail Deal')).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
    await user.click(editButtons[0]);
    expect(mockPush).not.toHaveBeenCalledWith('/deals/7/edit');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /edit deal/i }),
    ).toBeInTheDocument();
  });

  describe('Edit Deal', () => {
    it('edits deal title via contentEditable heading', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateDeal.mockResolvedValue({});

      render(<DealDetail dealId={7} currentUserId={1} />, { wrapper });
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
          'Detail Deal',
        ),
      );

      fireEvent.blur(screen.getByRole('heading', { level: 1 }), {
        target: { innerText: 'Updated Deal' },
      });
      await new Promise((r) => setTimeout(r, 2100));

      await waitFor(() => {
        expect(mockUpdateDeal).toHaveBeenCalledWith(
          7,
          expect.objectContaining({ title: 'Updated Deal' }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'deal', 7] }),
        );
      });
    });

    it('edits stage via combobox', async () => {
      const user = userEvent.setup();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateDeal.mockResolvedValue({});

      render(<DealDetail dealId={7} currentUserId={1} />, { wrapper });
      await waitFor(() =>
        expect(screen.getByText('Detail Deal')).toBeInTheDocument(),
      );

      // Stage is the 1st primary editable property (Owners has no pencil)
      await user.click(screen.getAllByTitle('Edit')[0]);
      const select = await screen.findByRole('combobox');
      await user.selectOptions(select, 'negotiation');

      await waitFor(() => {
        expect(mockUpdateDeal).toHaveBeenCalledWith(
          7,
          expect.objectContaining({ stage: 'negotiation' }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'deal', 7] }),
        );
      });
    });

    it('edits value and currency via currency field', async () => {
      const user = userEvent.setup();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateDeal.mockResolvedValue({});

      render(<DealDetail dealId={7} currentUserId={1} />, { wrapper });
      await waitFor(() =>
        expect(screen.getByText('Detail Deal')).toBeInTheDocument(),
      );

      // Value is the 2nd primary editable property
      await user.click(screen.getAllByTitle('Edit')[1]);

      // Currency combobox (mocked as select) + amount input
      const currencySelect = await screen.findByRole('combobox');
      await user.selectOptions(currencySelect, 'USD');

      const amountInput = screen.getByDisplayValue('25000');
      await user.clear(amountInput);
      await user.type(amountInput, '30000');

      // Blur the container to trigger save
      fireEvent.blur(amountInput.closest('div')!.parentElement!, {
        relatedTarget: null,
      });

      await waitFor(() => {
        expect(mockUpdateDeal).toHaveBeenCalledWith(
          7,
          expect.objectContaining({ value: 30000, currency: 'USD' }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'deal', 7] }),
        );
      });
    });

    it('edits priority via combobox', async () => {
      const user = userEvent.setup();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateDeal.mockResolvedValue({});

      render(<DealDetail dealId={7} currentUserId={1} />, { wrapper });
      await waitFor(() =>
        expect(screen.getByText('Detail Deal')).toBeInTheDocument(),
      );

      // Priority is the 3rd primary editable property
      await user.click(screen.getAllByTitle('Edit')[2]);
      const select = await screen.findByRole('combobox');
      await user.selectOptions(select, '3');

      await waitFor(() => {
        expect(mockUpdateDeal).toHaveBeenCalledWith(
          7,
          expect.objectContaining({ priority: 3 }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'deal', 7] }),
        );
      });
    });

    it('edits expected close date via date picker', async () => {
      const user = userEvent.setup();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateDeal.mockResolvedValue({});

      render(<DealDetail dealId={7} currentUserId={1} />, { wrapper });
      await waitFor(() =>
        expect(screen.getByText('Detail Deal')).toBeInTheDocument(),
      );

      // Expected Close is the 4th primary editable property
      await user.click(screen.getAllByTitle('Edit')[3]);

      const dateInput = document.querySelector(
        'input[type="date"]',
      ) as HTMLInputElement;
      expect(dateInput).toBeInTheDocument();
      fireEvent.change(dateInput, { target: { value: '2026-03-31' } });
      fireEvent.blur(dateInput);

      await waitFor(() => {
        expect(mockUpdateDeal).toHaveBeenCalledWith(
          7,
          expect.objectContaining({
            expectedCloseDate: expect.stringContaining('2026-03-31'),
          }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'deal', 7] }),
        );
      });
    });

    it('expands secondary properties and edits win probability', async () => {
      const user = userEvent.setup();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateDeal.mockResolvedValue({});

      render(<DealDetail dealId={7} currentUserId={1} />, { wrapper });
      await waitFor(() =>
        expect(screen.getByText('Detail Deal')).toBeInTheDocument(),
      );

      // Expand secondary properties
      await user.click(
        screen.getByRole('button', { name: /more properties/i }),
      );

      // Win Probability is null — click the dash span
      const probLabel = screen.getByText('Win Probability', { selector: 'dt' });
      await user.click(probLabel.closest('div')!.querySelector('span')!);

      const input = document.querySelector(
        'input[type="number"]',
      ) as HTMLInputElement;
      expect(input).toBeInTheDocument();
      fireEvent.change(input, { target: { value: '75' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockUpdateDeal).toHaveBeenCalledWith(
          7,
          expect.objectContaining({ probability: 75 }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'deal', 7] }),
        );
      });
    });

    it('expands secondary properties and edits actual close date', async () => {
      const user = userEvent.setup();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateDeal.mockResolvedValue({});

      render(<DealDetail dealId={7} currentUserId={1} />, { wrapper });
      await waitFor(() =>
        expect(screen.getByText('Detail Deal')).toBeInTheDocument(),
      );

      await user.click(
        screen.getByRole('button', { name: /more properties/i }),
      );

      // Actual Close is null — click the dash span
      const actualLabel = screen.getByText('Actual Close', { selector: 'dt' });
      await user.click(actualLabel.closest('div')!.querySelector('span')!);

      const dateInput = document.querySelector(
        'input[type="date"]',
      ) as HTMLInputElement;
      expect(dateInput).toBeInTheDocument();
      fireEvent.change(dateInput, { target: { value: '2026-04-01' } });
      fireEvent.blur(dateInput);

      await waitFor(() => {
        expect(mockUpdateDeal).toHaveBeenCalledWith(
          7,
          expect.objectContaining({
            actualCloseDate: expect.stringContaining('2026-04-01'),
          }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'deal', 7] }),
        );
      });
    });

    it('expands secondary properties and edits source', async () => {
      const user = userEvent.setup();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateDeal.mockResolvedValue({});

      render(<DealDetail dealId={7} currentUserId={1} />, { wrapper });
      await waitFor(() =>
        expect(screen.getByText('Detail Deal')).toBeInTheDocument(),
      );

      await user.click(
        screen.getByRole('button', { name: /more properties/i }),
      );

      // Click the pencil inside the Source property cell
      const sourceLabel = screen.getByText('Source', { selector: 'dt' });
      await user.click(
        sourceLabel.closest('div')!.querySelector('button[title="Edit"]')!,
      );

      const input = screen.getByDisplayValue('Referral');
      await user.clear(input);
      await user.type(input, 'Outbound');
      await user.tab();

      await waitFor(() => {
        expect(mockUpdateDeal).toHaveBeenCalledWith(
          7,
          expect.objectContaining({ source: 'Outbound' }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'deal', 7] }),
        );
      });
    });
  });
});

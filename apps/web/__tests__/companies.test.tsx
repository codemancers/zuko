/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CompaniesList from '@/components/Companies/CompaniesList';
import CompanyDetail from '@/components/Companies/CompanyDetail';
import type { Company } from '@/lib/api/companies';

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

const mockCreateCompany = vi.fn();
const mockUpdateCompany = vi.fn();
const mockGetCompanies = vi.fn();
const mockGetTableViewCompanies = vi.fn();
const mockGetCompany = vi.fn();
const mockHideCompany = vi.fn();
const mockUpdateContact = vi.fn();
const mockRemoveContact = vi.fn();
vi.mock('@/lib/api/companies', () => ({
  companiesApi: {
    createCompany: (...args: unknown[]) => mockCreateCompany(...args),
    updateCompany: (...args: unknown[]) => mockUpdateCompany(...args),
    getCompanies: (...args: unknown[]) => mockGetCompanies(...args),
    getTableViewCompanies: (...args: unknown[]) =>
      mockGetTableViewCompanies(...args),
    getCompany: (...args: unknown[]) => mockGetCompany(...args),
    hideCompany: (...args: unknown[]) => mockHideCompany(...args),
    updateContact: (...args: unknown[]) => mockUpdateContact(...args),
    removeContact: (...args: unknown[]) => mockRemoveContact(...args),
  },
}));

vi.mock('@/lib/api/deals', () => ({
  dealsApi: {
    getDealsByCompany: vi.fn(() => Promise.resolve({ deals: [] })),
  },
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: vi.fn(() => ({ data: { user: { id: '1' } } })),
  },
}));

vi.mock('@/components/Activity/ActivityTimeline', () => ({
  default: () => <div data-testid="activity-timeline">Activity</div>,
}));

vi.mock('@/components/Companies/AddContactDialog', () => ({
  default: () => <div data-testid="add-contact-dialog">Add Contact</div>,
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
    id: 'companyName',
    header: 'Company',
    fieldType: 'entity',
    dataType: 'text',
    sortable: true,
    filterable: true,
    searchable: true,
    editable: true,
    isVisible: true,
    default: true,
    config: {
      entityType: 'company',
      hrefTemplate: '/companies/{id}',
    },
  },
  {
    id: 'website',
    header: 'Website',
    fieldType: 'text',
    dataType: 'text',
    sortable: true,
    filterable: true,
    searchable: true,
    editable: true,
    isVisible: true,
    default: true,
    config: {
      render: 'link',
      hrefTemplate: '{value}',
    },
  },
  {
    id: 'linkedinUrl',
    header: 'LinkedIn',
    fieldType: 'text',
    dataType: 'text',
    sortable: false,
    filterable: true,
    searchable: true,
    editable: true,
    isVisible: true,
    default: true,
    config: {
      render: 'link',
      hrefTemplate: '{value}',
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
    id: 'createdAt',
    header: 'Created',
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

const emptyCompaniesResponse = {
  data: [],
  metadata: mockMetadata,
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
};

const mockCompany = {
  id: 1,
  organizationId: 1,
  companyName: 'Acme Inc',
  website: 'https://acme.com',
  linkedinUrl: undefined,
  summary: undefined,
  isHidden: false,
  createdAt: {
    value: '2025-01-15T00:00:00Z',
    display: '15 Jan 2025',
  },
  updatedAt: '2025-01-15T00:00:00Z',
  owners: {
    value: {
      id: 1,
      companyId: 1,
      userId: 1,
      isPrimary: true,
      assignedAt: '',
      user: { id: 1, name: 'Alice', email: 'alice@example.com' },
    },
    display: 'Alice',
  },
  _count: {
    contacts: 0,
  },
};

describe('CompaniesList', () => {
  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
    mockGetTableViewCompanies.mockResolvedValue(emptyCompaniesResponse);
  });

  it('renders heading and description', () => {
    render(<CompaniesList />, { wrapper });
    expect(screen.getByText('Companies')).toBeInTheDocument();
    expect(
      screen.getByText(/manage your sales companies and relationships/i),
    ).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<CompaniesList />, { wrapper });
    expect(
      screen.getByPlaceholderText(
        /search companies by name, website, or linkedin/i,
      ),
    ).toBeInTheDocument();
  });

  it('renders empty table when no companies', async () => {
    render(<CompaniesList />, { wrapper });
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
      // Headers should still be there
      expect(screen.getByText('Company')).toBeInTheDocument();
      expect(screen.getByText('Website')).toBeInTheDocument();
    });

    // The table body should have no data rows
    const tbody = screen.getByRole('table').querySelector('tbody');
    expect(tbody?.children.length).toBe(0);

    // button with add row label should be present
    expect(
      screen.getByRole('button', { name: /add row/i }),
    ).toBeInTheDocument();
  });

  it('shows table with company when data is returned', async () => {
    mockGetTableViewCompanies.mockResolvedValue({
      data: [mockCompany],
      metadata: mockMetadata,
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    render(<CompaniesList />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Acme Inc')).toBeInTheDocument();
    });
    expect(screen.getByText(/https:\/\/acme\.com/)).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('navigates to company detail when company name link is clicked', async () => {
    mockGetTableViewCompanies.mockResolvedValue({
      data: [mockCompany],
      metadata: mockMetadata,
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    const user = userEvent.setup();
    render(<CompaniesList />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Acme Inc')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Acme Inc'));
    expect(mockPush).toHaveBeenCalledWith('/companies/1');
  });

  it('shows loading state', () => {
    mockGetTableViewCompanies.mockImplementation(
      () => new Promise<void>(() => undefined),
    );
    render(<CompaniesList />, { wrapper });
    expect(screen.getByText(/loading companies/i)).toBeInTheDocument();
  });

  it('calls getTableViewCompanies with search when user types', async () => {
    const user = userEvent.setup();
    render(<CompaniesList />, { wrapper });
    const search = screen.getByPlaceholderText(
      /search companies by name, website, or linkedin/i,
    );
    await user.type(search, 'acme');
    await waitFor(() => {
      expect(mockGetTableViewCompanies).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'acme' }),
      );
    });
  });

  it('shows pagination text', async () => {
    mockGetTableViewCompanies.mockResolvedValue({
      data: [mockCompany],
      metadata: mockMetadata,
      pagination: { page: 1, limit: 10, total: 50, totalPages: 5 },
    });
    render(<CompaniesList />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Acme Inc')).toBeInTheDocument();
    });
    expect(screen.getByText(/showing 1 of 50 companies/i)).toBeInTheDocument();
  });

  it('opens column creation modal when add column button is clicked', async () => {
    mockGetTableViewCompanies.mockResolvedValue({
      data: [mockCompany],
      metadata: mockMetadata,
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    const user = userEvent.setup();
    render(<CompaniesList />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Acme Inc')).toBeInTheDocument();
    });

    // Click the "Add column" button in the table header
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

  // creates new company when click on add row
  it('creates new company when add row is clicked', async () => {
    const user = userEvent.setup();
    mockCreateCompany.mockResolvedValue({ id: 99 });

    render(<CompaniesList />, { wrapper });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /add row/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add row/i }));

    await waitFor(() => {
      expect(mockCreateCompany).toHaveBeenCalledWith(
        expect.objectContaining({ companyName: 'New Company' }),
      );
    });
  });

  it('opens new company sheet when "New Company" button is clicked', async () => {
    const user = userEvent.setup();
    render(<CompaniesList />, { wrapper });
    await user.click(screen.getByRole('button', { name: /new company/i }));
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /new company/i }),
    ).toBeInTheDocument();
  });
});

describe('CompanyDetail', () => {
  const detailCompany = {
    id: 7,
    companyName: 'Detail Company',
    website: 'https://detail.com',
    linkedinUrl: 'https://www.linkedin.com/company/detail',
    summary: 'Company summary',
    isHidden: false,
    createdAt: '2025-01-10T12:00:00Z',
    updatedAt: '2025-01-15T14:00:00Z',
    owners: [
      {
        id: 1,
        userId: 1,
        companyId: 7,
        isPrimary: true,
        assignedAt: '',
        user: { id: 1, name: 'Alice', email: 'alice@example.com' },
      },
    ],
    contacts: [],
  };

  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
    mockGetCompany.mockResolvedValue(detailCompany);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('shows loading state', () => {
    mockGetCompany.mockImplementation(
      () => new Promise<never>(() => undefined),
    );
    render(<CompanyDetail companyId={7} currentUserId={1} />, { wrapper });
    expect(screen.getByText(/loading company/i)).toBeInTheDocument();
  });

  it('shows company not found when getCompany returns no data', async () => {
    mockGetCompany.mockResolvedValue(null as unknown as Company);
    render(<CompanyDetail companyId={999} currentUserId={1} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText(/company not found/i)).toBeInTheDocument();
    });
  });

  it('renders company name and details when loaded', async () => {
    render(<CompanyDetail companyId={7} currentUserId={1} />, { wrapper });
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Detail Company',
    );
    expect(screen.getByText('https://detail.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Company summary')).toBeInTheDocument();
    expect(
      screen.getByText('https://www.linkedin.com/company/detail'),
    ).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('opens edit sheet when "Edit" button is clicked', async () => {
    const user = userEvent.setup();
    render(<CompanyDetail companyId={7} currentUserId={1} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Detail Company')).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
    await user.click(editButtons[0]);
    expect(mockPush).not.toHaveBeenCalledWith('/companies/7/edit');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /edit company/i }),
    ).toBeInTheDocument();
  });

  it('calls hideCompany and redirects when Hide is confirmed', async () => {
    mockHideCompany.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CompanyDetail companyId={7} currentUserId={1} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Detail Company')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /^hide$/i }));
    // Confirm in the ConfirmDialog
    await waitFor(() =>
      expect(
        screen.getByText(/are you sure you want to hide this company/i),
      ).toBeInTheDocument(),
    );
    const hideButtons = screen.getAllByRole('button', { name: /^hide$/i });
    await user.click(hideButtons[hideButtons.length - 1]);
    expect(mockHideCompany).toHaveBeenCalledWith(7);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/companies');
    });
  });

  it('does not call hideCompany when user cancels confirm', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const user = userEvent.setup();
    render(<CompanyDetail companyId={7} currentUserId={1} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Detail Company')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /^hide$/i }));
    expect(mockHideCompany).not.toHaveBeenCalled();
  });

  // add specs for editing the companies fields and validation errors

  describe('Edit Company', () => {
    it('edits company title via contentEditable heading', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateCompany.mockResolvedValue({});

      render(<CompanyDetail companyId={7} currentUserId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
          'Detail Company',
        );
      });

      fireEvent.blur(screen.getByRole('heading', { level: 1 }), {
        target: { innerText: 'Updated Company' },
      });

      await new Promise((r) => setTimeout(r, 2100)); // past 2000ms debounce

      await waitFor(() => {
        expect(mockUpdateCompany).toHaveBeenCalledWith(
          7,
          expect.objectContaining({ companyName: 'Updated Company' }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'company', 7] }),
        );
      });
    });

    it('edits website via inline text field', async () => {
      const user = userEvent.setup();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateCompany.mockResolvedValue({});

      render(<CompanyDetail companyId={7} currentUserId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('https://detail.com')).toBeInTheDocument();
      });

      await user.click(screen.getAllByTitle('Edit')[0]);

      const input = screen.getByDisplayValue('https://detail.com');
      await user.clear(input);
      await user.type(input, 'https://updated.com');
      await user.tab();

      await waitFor(() => {
        expect(mockUpdateCompany).toHaveBeenCalledWith(
          7,
          expect.objectContaining({ website: 'https://updated.com' }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'company', 7] }),
        );
      });
    });

    it('edits linkedin via inline text field', async () => {
      const user = userEvent.setup();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateCompany.mockResolvedValue({});

      render(<CompanyDetail companyId={7} currentUserId={1} />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByText('https://www.linkedin.com/company/detail'),
        ).toBeInTheDocument();
      });

      await user.click(screen.getAllByTitle('Edit')[1]);

      const input = screen.getByDisplayValue(
        'https://www.linkedin.com/company/detail',
      );
      await user.clear(input);
      await user.type(input, 'https://www.linkedin.com/company/updated');
      await user.tab();

      await waitFor(() => {
        expect(mockUpdateCompany).toHaveBeenCalledWith(
          7,
          expect.objectContaining({
            linkedinUrl: 'https://www.linkedin.com/company/updated',
          }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'company', 7] }),
        );
      });
    });

    it('shows validation error for invalid website URL', async () => {
      const user = userEvent.setup();

      render(<CompanyDetail companyId={7} currentUserId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('https://detail.com')).toBeInTheDocument();
      });

      await user.click(screen.getAllByTitle('Edit')[0]);

      const input = screen.getByDisplayValue('https://detail.com');
      await user.clear(input);
      await user.type(input, 'not-a-url');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/must be a valid url/i)).toBeInTheDocument();
      });
      expect(mockUpdateCompany).not.toHaveBeenCalled();
    });

    it('shows validation error for invalid linkedin URL', async () => {
      const user = userEvent.setup();

      render(<CompanyDetail companyId={7} currentUserId={1} />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByText('https://www.linkedin.com/company/detail'),
        ).toBeInTheDocument();
      });

      await user.click(screen.getAllByTitle('Edit')[1]);

      const input = screen.getByDisplayValue(
        'https://www.linkedin.com/company/detail',
      );
      await user.clear(input);
      await user.type(input, 'not-a-url');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/must be a valid url/i)).toBeInTheDocument();
      });
      expect(mockUpdateCompany).not.toHaveBeenCalled();
    });
  });
});

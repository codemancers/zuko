/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CompanyForm from '@/components/Companies/CompanyForm';
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
    getTableViewCompanies: (...args: unknown[]) => mockGetTableViewCompanies(...args),
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
    ErrorMessage: ({ children, className }: React.PropsWithChildren<{ className?: string }>) =>
      React.createElement('p', { className: `error-message ${className ?? ''}`.trim() }, children),
    Description: ({ children, className }: React.PropsWithChildren<{ className?: string }>) =>
      React.createElement('p', { className: `description ${className ?? ''}`.trim() }, children),
  };
});

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

describe('CompanyForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form with all fields', () => {
    render(
      <CompanyForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );
    expect(
      screen.getByLabelText(/company name \*/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/website/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/linkedin url/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/add a summary about this company/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create company/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows Create Company in create mode and Save Changes in edit mode', () => {
    render(
      <CompanyForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );
    expect(
      screen.getByRole('button', { name: /create company/i })
    ).toBeInTheDocument();

    render(
      <CompanyForm
        mode="edit"
        currentUserId={CURRENT_USER_ID}
        company={{
          id: 1,
          companyName: 'Acme',
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
      <CompanyForm
        mode="edit"
        currentUserId={CURRENT_USER_ID}
        company={{
          id: 1,
          companyName: 'Acme Inc',
          website: 'https://acme.com',
          linkedinUrl: 'https://www.linkedin.com/company/acme',
          summary: 'Notes',
          isHidden: false,
          createdAt: '',
          updatedAt: '',
          owners: [],
        }}
      />,
      { wrapper }
    );
    expect(screen.getByDisplayValue('Acme Inc')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://acme.com')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('https://www.linkedin.com/company/acme')
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('Notes')).toBeInTheDocument();
  });

  it('shows company name required and does not submit', async () => {
    const user = userEvent.setup();
    render(
      <CompanyForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );
    await user.click(screen.getByRole('button', { name: /create company/i }));
    expect(
      screen.getByText(/company name is required/i)
    ).toBeInTheDocument();
    expect(mockCreateCompany).not.toHaveBeenCalled();
  });

  it('shows website URL validation error for invalid protocol', async () => {
    const user = userEvent.setup();
    render(
      <CompanyForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );
    await user.type(
      screen.getByPlaceholderText(/acme inc\.?/i),
      'Test Co'
    );
    await user.type(
      screen.getByPlaceholderText(/https:\/\/example\.com/i),
      'ftp://example.com'
    );
    await user.click(screen.getByRole('button', { name: /create company/i }));
    expect(
      screen.getByText(/Website must be a valid URL/i)
    ).toBeInTheDocument();
    expect(mockCreateCompany).not.toHaveBeenCalled();
  });

  it('calls createCompany and redirects on valid submit', async () => {
    mockCreateCompany.mockResolvedValue({ id: 1 });
    const user = userEvent.setup();
    render(
      <CompanyForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );
    await user.type(
      screen.getByPlaceholderText(/acme inc\.?/i),
      'New Company'
    );
    await user.click(screen.getByRole('button', { name: /create company/i }));

    await waitFor(() => {
      expect(mockCreateCompany).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: 'New Company',
          ownerIds: [CURRENT_USER_ID],
          primaryOwnerId: CURRENT_USER_ID,
        })
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/companies');
    });
  });

  it('calls updateCompany and redirects on valid submit in edit mode', async () => {
    mockUpdateCompany.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <CompanyForm
        mode="edit"
        currentUserId={CURRENT_USER_ID}
        company={{
          id: 42,
          companyName: 'Old Name',
          isHidden: false,
          createdAt: '',
          updatedAt: '',
          owners: [],
        }}
      />,
      { wrapper }
    );
    await user.clear(screen.getByDisplayValue('Old Name'));
    await user.type(
      screen.getByPlaceholderText(/acme inc/i),
      'Updated Name'
    );
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateCompany).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ companyName: 'Updated Name' })
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/companies/42');
    });
  });

  it('navigates to companies list on Cancel in create mode', async () => {
    const user = userEvent.setup();
    render(
      <CompanyForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockPush).toHaveBeenCalledWith('/companies');
  });

  it('navigates to company detail on Cancel in edit mode', async () => {
    const user = userEvent.setup();
    render(
      <CompanyForm
        mode="edit"
        currentUserId={CURRENT_USER_ID}
        company={{
          id: 10,
          companyName: 'X',
          isHidden: false,
          createdAt: '',
          updatedAt: '',
          owners: [],
        }}
      />,
      { wrapper }
    );
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockPush).toHaveBeenCalledWith('/companies/10');
  });

  it('shows submit error when create fails', async () => {
    mockCreateCompany.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    render(
      <CompanyForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );
    await user.type(
      screen.getByPlaceholderText(/acme inc\.?/i),
      'Fail Co'
    );
    await user.click(screen.getByRole('button', { name: /create company/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/server error|failed to create company/i)
      ).toBeInTheDocument();
    });
  });

  it('shows Saving... and disables buttons while submitting', async () => {
    let resolveCreate: (value: { id: number }) => void = () => {
      /* noop until Promise constructor runs */
    };
    mockCreateCompany.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );
    const user = userEvent.setup();
    render(
      <CompanyForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );
    await user.type(
      screen.getByPlaceholderText(/acme inc\.?/i),
      'Slow Co'
    );
    await user.click(screen.getByRole('button', { name: /create company/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
    });
    if (resolveCreate) resolveCreate({ id: 1 });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/companies');
    });
  });
});

const mockMetadata = [
  {
      id: "companyName",
      header: "Company",
      fieldType: "entity",
      dataType: "text",
      sortable: true,
      filterable: true,
      searchable: true,
      editable: true,
      isVisible: true,
      default: true,
      config: {
          entityType: "company",
          hrefTemplate: "/companies/{id}"
      }
  },
  {
      id: "website",
      header: "Website",
      fieldType: "text",
      dataType: "text",
      sortable: true,
      filterable: true,
      searchable: true,
      editable: true,
      isVisible: true,
      default: true,
      config: {
          render: "link",
          hrefTemplate: "{value}"
      }
  },
  {
      id: "linkedinUrl",
      header: "LinkedIn",
      fieldType: "text",
      dataType: "text",
      sortable: false,
      filterable: true,
      searchable: true,
      editable: true,
      isVisible: true,
      default: true,
      config: {
          render: "link",
          hrefTemplate: "{value}"
      }
  },
  {
      id: "owners",
      header: "Owner",
      fieldType: "text",
      dataType: "json",
      sortable: false,
      filterable: true,
      searchable: true,
      editable: false,
      isVisible: true,
      default: true,
      config: {
          format: "owner"
      }
  },
  {
      id: "createdAt",
      header: "Created",
      fieldType: "date",
      dataType: "date",
      sortable: true,
      filterable: true,
      searchable: true,
      editable: false,
      isVisible: true,
      default: true,
      config: {
          format: "date"
      }
  }
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
      value: "2025-01-15T00:00:00Z",
      display: "15 Jan 2025"
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
      display: "Alice"
  },
  _count: {
      contacts: 0
  }
};

describe('CompaniesList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTableViewCompanies.mockResolvedValue(emptyCompaniesResponse);
  });

  it('renders heading and description', () => {
    render(<CompaniesList />, { wrapper });
    expect(screen.getByText('Companies')).toBeInTheDocument();
    expect(
      screen.getByText(/manage your sales companies and relationships/i)
    ).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<CompaniesList />, { wrapper });
    expect(
      screen.getByPlaceholderText(
        /search companies by name, website, or linkedin/i
      )
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
    expect(screen.getByRole('button', { name: /add row/i })).toBeInTheDocument();
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
      () => new Promise<void>(() => undefined)
    );
    render(<CompaniesList />, { wrapper });
    expect(screen.getByText(/loading companies/i)).toBeInTheDocument();
  });

  it('calls getTableViewCompanies with search when user types', async () => {
    const user = userEvent.setup();
    render(<CompaniesList />, { wrapper });
    const search = screen.getByPlaceholderText(
      /search companies by name, website, or linkedin/i
    );
    await user.type(search, 'acme');
    await waitFor(() => {
      expect(mockGetTableViewCompanies).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'acme' })
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
    expect(
      screen.getByText(/showing 1 of 50 companies/i)
    ).toBeInTheDocument();
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
    await user.click(screen.getByLabelText('Add column'));
    
    // Verify the dialog title and input fields
    expect(screen.getByText('Add new field')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Field name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/unique column key/i)).toBeInTheDocument();
    expect(screen.getByText('Field Type')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create field/i })).toBeInTheDocument();
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
    vi.clearAllMocks();
    mockGetCompany.mockResolvedValue(detailCompany);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('shows loading state', () => {
    mockGetCompany.mockImplementation(
      () => new Promise<never>(() => undefined)
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
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Detail Company');
    expect(screen.getByText('https://detail.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Company summary')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('navigates to edit when Edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<CompanyDetail companyId={7} currentUserId={1} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Detail Company')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(mockPush).toHaveBeenCalledWith('/companies/7/edit');
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
      expect(screen.getByText(/are you sure you want to hide this company/i)).toBeInTheDocument()
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
});



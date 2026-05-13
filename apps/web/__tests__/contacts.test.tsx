/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContactsList from '@/components/Contacts/ContactsList';
import ContactDetail from '@/components/Contacts/ContactDetail';
import type { Contact } from '@/lib/api/contacts';

// Mock next/navigation
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

// Mock contacts API
const mockCreateContact = vi.fn();
const mockUpdateContact = vi.fn();
const mockGetContacts = vi.fn();
const mockGetTableViewContacts = vi.fn();
const mockGetContact = vi.fn();
const mockHideContact = vi.fn();
vi.mock('@/lib/api/contacts', () => ({
  contactsApi: {
    createContact: (...args: unknown[]) => mockCreateContact(...args),
    updateContact: (...args: unknown[]) => mockUpdateContact(...args),
    getContacts: (...args: unknown[]) => mockGetContacts(...args),
    getTableViewContacts: (...args: unknown[]) =>
      mockGetTableViewContacts(...args),
    getContact: (...args: unknown[]) => mockGetContact(...args),
    hideContact: (...args: unknown[]) => mockHideContact(...args),
  },
}));

vi.mock('@/lib/api/deals', () => ({
  dealsApi: {
    getDealsByContact: vi.fn(() => Promise.resolve({ deals: [] })),
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
    id: 'name',
    header: 'Name',
    fieldType: 'entity',
    dataType: 'text',
    sortable: true,
    filterable: true,
    searchable: true,
    editable: true,
    isVisible: true,
    default: true,
    config: {
      entityType: 'contact',
      hrefTemplate: '/contacts/{id}',
    },
  },
  {
    id: 'email',
    header: 'Email',
    fieldType: 'text',
    dataType: 'text',
    sortable: false,
    filterable: true,
    searchable: true,
    editable: true,
    isVisible: true,
    default: true,
    config: {
      render: 'email',
      accessorKey: 'email',
    },
  },
  {
    id: 'phone',
    header: 'Phone',
    fieldType: 'text',
    dataType: 'text',
    sortable: false,
    filterable: true,
    searchable: true,
    editable: true,
    isVisible: true,
    default: true,
    config: {
      render: 'phone',
      accessorKey: 'phone',
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

const emptyContactsResponse = {
  data: [],
  metadata: mockMetadata,
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
};

const mockContact = {
  id: 1,
  organizationId: 1,
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+14155552671',
  linkedinId: 'john-doe-123',
  notes: 'test',
  isHidden: false,
  createdAt: {
    value: '2026-03-10T07:30:06.648Z',
    display: '10 Mar 2026',
  },
  updatedAt: '2026-03-10T07:30:06.648Z',
  owners: {
    value: {
      id: 1,
      contactId: 1,
      userId: 1,
      isPrimary: true,
      assignedAt: '2026-03-10T07:30:06.648Z',
      user: {
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
      },
    },
    display: 'Alice',
  },
};

describe('ContactsList', () => {
  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
    mockGetTableViewContacts.mockResolvedValue(emptyContactsResponse);
  });

  it('renders heading and description', () => {
    render(<ContactsList />, { wrapper });
    expect(screen.getByText('Contacts')).toBeInTheDocument();
    expect(
      screen.getByText(/manage your sales contacts and relationships/i),
    ).toBeInTheDocument();
  });

  it('renders search input with placeholder', () => {
    render(<ContactsList />, { wrapper });
    expect(
      screen.getByPlaceholderText(
        /search contacts by name, email, phone, or linkedin/i,
      ),
    ).toBeInTheDocument();
  });

  it('updates search input when user types', async () => {
    const user = userEvent.setup();
    render(<ContactsList />, { wrapper });
    const search = screen.getByPlaceholderText(
      /search contacts by name, email, phone, or linkedin/i,
    );
    await user.type(search, 'john');
    expect(search).toHaveValue('john');
  });

  it('renders empty state when no contacts', async () => {
    render(<ContactsList />, { wrapper });
    await vi.waitFor(() => {
      expect(screen.getByText('No contacts yet')).toBeInTheDocument();
    });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Name')).not.toBeInTheDocument();
    expect(screen.queryByText('Email')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /new contact/i }).length).toBe(
      2,
    );
  });

  it('shows table with contact when data is returned', async () => {
    mockGetTableViewContacts.mockResolvedValue({
      data: [mockContact],
      metadata: mockMetadata,
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    render(<ContactsList />, { wrapper });
    await vi.waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('navigates to contact detail when contact name link is clicked', async () => {
    mockGetTableViewContacts.mockResolvedValue({
      data: [mockContact],
      metadata: mockMetadata,
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    const user = userEvent.setup();
    render(<ContactsList />, { wrapper });
    await vi.waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    // Click a contact name link cell to navigate to contact details page
    await user.click(screen.getByText('John Doe'));
    expect(mockPush).toHaveBeenCalledWith('/contacts/1');
  });

  it('shows loading state while fetching contacts', () => {
    mockGetTableViewContacts.mockImplementation(
      () => new Promise<never>(() => undefined), // never resolves
    );
    render(<ContactsList />, { wrapper });
    expect(screen.getByText(/loading contacts/i)).toBeInTheDocument();
  });

  it('calls getTableViewContacts with search param when user types in search', async () => {
    const user = userEvent.setup();
    render(<ContactsList />, { wrapper });
    const search = screen.getByPlaceholderText(
      /search contacts by name, email, phone, or linkedin/i,
    );
    await user.type(search, 'alice');
    await vi.waitFor(() => {
      expect(mockGetTableViewContacts).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'alice' }),
      );
    });
  });

  it('shows pagination text when data has pagination', async () => {
    mockGetTableViewContacts.mockResolvedValue({
      data: [mockContact],
      metadata: mockMetadata,
      pagination: { page: 1, limit: 10, total: 42, totalPages: 5 },
    });
    render(<ContactsList />, { wrapper });
    await vi.waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    expect(screen.getByText(/showing 1 of 42 contacts/i)).toBeInTheDocument();
  });

  it('opens column creation modal when add column button is clicked', async () => {
    mockGetTableViewContacts.mockResolvedValue({
      data: [mockContact],
      metadata: mockMetadata,
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    const user = userEvent.setup();
    render(<ContactsList />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
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

  it('does not render the removed add row button', async () => {
    render(<ContactsList />, { wrapper });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /new contact/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /add row/i }),
    ).not.toBeInTheDocument();
    expect(mockCreateContact).not.toHaveBeenCalled();
  });

  it('opens new contact sheet when "New Contact" button is clicked', async () => {
    const user = userEvent.setup();
    render(<ContactsList />, { wrapper });
    await user.click(screen.getByRole('button', { name: /new contact/i }));
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /new contact/i }),
    ).toBeInTheDocument();
  });
});

describe('ContactDetail', () => {
  const detailContact = {
    id: 7,
    name: 'Detail Contact',
    email: 'detail@example.com',
    phone: '+14155550000',
    linkedinId: 'detail-linkedin',
    notes: 'Some notes here',
    isHidden: false,
    createdAt: '2025-01-10T12:00:00Z',
    updatedAt: '2025-01-15T14:00:00Z',
    owners: [
      {
        id: 1,
        userId: 1,
        contactId: 7,
        isPrimary: true,
        assignedAt: '',
        user: { id: 1, name: 'Alice', email: 'alice@example.com' },
      },
    ],
  };

  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
    mockGetContact.mockResolvedValue(detailContact);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('shows loading state while fetching contact', () => {
    mockGetContact.mockImplementation(
      () => new Promise<never>(() => undefined),
    );
    render(<ContactDetail contactId={7} currentUserId={1} />, { wrapper });
    expect(screen.getByText(/loading contact/i)).toBeInTheDocument();
  });

  it('shows contact not found when getContact returns no data', async () => {
    mockGetContact.mockResolvedValue(null as unknown as Contact);
    render(<ContactDetail contactId={999} currentUserId={1} />, { wrapper });
    await vi.waitFor(() => {
      expect(screen.getByText(/contact not found/i)).toBeInTheDocument();
    });
  });

  it('renders contact name and details when loaded', async () => {
    render(<ContactDetail contactId={7} currentUserId={1} />, { wrapper });
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Detail Contact',
    );
    expect(screen.getByText('detail@example.com')).toBeInTheDocument();
    expect(screen.getByText('+14155550000')).toBeInTheDocument();
    expect(screen.getByText('detail-linkedin')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Some notes here')).toBeInTheDocument();
  });

  it('calls hideContact and redirects when Hide is confirmed', async () => {
    mockHideContact.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ContactDetail contactId={7} currentUserId={1} />, { wrapper });
    await vi.waitFor(() => {
      expect(screen.getByText('Detail Contact')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /^hide$/i }));
    // Confirm in the ConfirmDialog
    await vi.waitFor(() =>
      expect(
        screen.getByText(/are you sure you want to hide this contact/i),
      ).toBeInTheDocument(),
    );
    const hideButtons = screen.getAllByRole('button', { name: /^hide$/i });
    await user.click(hideButtons[hideButtons.length - 1]);
    expect(mockHideContact).toHaveBeenCalledWith(7);
    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/contacts');
    });
  });

  it('does not call hideContact when user cancels confirm', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const user = userEvent.setup();
    render(<ContactDetail contactId={7} currentUserId={1} />, { wrapper });
    await vi.waitFor(() => {
      expect(screen.getByText('Detail Contact')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /^hide$/i }));
    expect(mockHideContact).not.toHaveBeenCalled();
  });

  it('opens edit sheet when "Edit" button is clicked', async () => {
    const user = userEvent.setup();
    render(<ContactDetail contactId={7} currentUserId={1} />, { wrapper });
    await vi.waitFor(() => {
      expect(screen.getByText('Detail Contact')).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
    await user.click(editButtons[0]);
    expect(mockPush).not.toHaveBeenCalledWith('/contacts/7/edit');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /edit contact/i }),
    ).toBeInTheDocument();
  });

  describe('Edit Contact', () => {
    it('edits contact title via contentEditable heading', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateContact.mockResolvedValue({});

      render(<ContactDetail contactId={7} currentUserId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
          'Detail Contact',
        );
      });

      fireEvent.blur(screen.getByRole('heading', { level: 1 }), {
        target: { innerText: 'Updated Contact' },
      });

      await new Promise((r) => setTimeout(r, 2100)); // past 2000ms debounce

      await waitFor(() => {
        expect(mockUpdateContact).toHaveBeenCalledWith(
          7,
          expect.objectContaining({ name: 'Updated Contact' }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'contact', 7] }),
        );
      });
    });

    it('edits email via inline text field', async () => {
      const user = userEvent.setup();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateContact.mockResolvedValue({});

      render(<ContactDetail contactId={7} currentUserId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('detail@example.com')).toBeInTheDocument();
      });

      await user.click(screen.getAllByTitle('Edit')[0]);

      const input = screen.getByDisplayValue('detail@example.com');
      await user.clear(input);
      await user.type(input, 'updated@example.com');
      await user.tab();

      await waitFor(() => {
        expect(mockUpdateContact).toHaveBeenCalledWith(
          7,
          expect.objectContaining({ email: 'updated@example.com' }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'contact', 7] }),
        );
      });
    });

    it('edits phone via inline text field', async () => {
      const user = userEvent.setup();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateContact.mockResolvedValue({});

      render(<ContactDetail contactId={7} currentUserId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('+14155550000')).toBeInTheDocument();
      });

      await user.click(screen.getAllByTitle('Edit')[1]);

      const input = screen.getByDisplayValue('+14155550000');
      await user.clear(input);
      await user.type(input, '+14155559999');
      await user.tab();

      await waitFor(() => {
        expect(mockUpdateContact).toHaveBeenCalledWith(
          7,
          expect.objectContaining({ phone: '+14155559999' }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'contact', 7] }),
        );
      });
    });

    it('edits linkedinId via inline text field', async () => {
      const user = userEvent.setup();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateContact.mockResolvedValue({});

      render(<ContactDetail contactId={7} currentUserId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('detail-linkedin')).toBeInTheDocument();
      });

      await user.click(screen.getAllByTitle('Edit')[2]);

      const input = screen.getByDisplayValue('detail-linkedin');
      await user.clear(input);
      await user.type(input, 'updated-linkedin');
      await user.tab();

      await waitFor(() => {
        expect(mockUpdateContact).toHaveBeenCalledWith(
          7,
          expect.objectContaining({ linkedinId: 'updated-linkedin' }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'contact', 7] }),
        );
      });
    });

    it('shows validation error for invalid email', async () => {
      const user = userEvent.setup();

      render(<ContactDetail contactId={7} currentUserId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('detail@example.com')).toBeInTheDocument();
      });

      await user.click(screen.getAllByTitle('Edit')[0]);

      const input = screen.getByDisplayValue('detail@example.com');
      await user.clear(input);
      await user.type(input, 'not-an-email');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/must be a valid email/i)).toBeInTheDocument();
      });
      expect(mockUpdateContact).not.toHaveBeenCalled();
    });

    it('shows validation error for invalid phone format', async () => {
      const user = userEvent.setup();

      render(<ContactDetail contactId={7} currentUserId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('+14155550000')).toBeInTheDocument();
      });

      await user.click(screen.getAllByTitle('Edit')[1]);

      const input = screen.getByDisplayValue('+14155550000');
      await user.clear(input);
      await user.type(input, '12345');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/E\.164 format/i)).toBeInTheDocument();
      });
      expect(mockUpdateContact).not.toHaveBeenCalled();
    });
  });
});

/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContactForm from '@/components/Contacts/ContactForm';
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
    getTableViewContacts: (...args: unknown[]) => mockGetTableViewContacts(...args),
    getContact: (...args: unknown[]) => mockGetContact(...args),
    hideContact: (...args: unknown[]) => mockHideContact(...args),
  },
}));

vi.mock('@/lib/api/deals', () => ({
  dealsApi: {
    getDealsByContact: vi.fn(() => Promise.resolve({ deals: [] })),
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

describe('ContactForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form with all fields', () => {
    render(
      <ContactForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );

    expect(screen.getByLabelText(/name \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/linkedin id/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/add notes about this contact/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create contact/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows Create Contact submit button in create mode', () => {
    render(
      <ContactForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );
    expect(
      screen.getByRole('button', { name: /create contact/i })
    ).toBeInTheDocument();
  });

  it('shows Save Changes submit button in edit mode', () => {
    render(
      <ContactForm
        mode="edit"
        currentUserId={CURRENT_USER_ID}
        contact={{
          id: 1,
          name: 'Jane Doe',
          email: 'jane@example.com',
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

  it('prefills fields when editing a contact', () => {
    render(
      <ContactForm
        mode="edit"
        currentUserId={CURRENT_USER_ID}
        contact={{
          id: 1,
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+14155552671',
          linkedinId: 'jane-doe',
          notes: 'Some notes',
          isHidden: false,
          createdAt: '',
          updatedAt: '',
          owners: [],
        }}
      />,
      { wrapper }
    );

    expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jane@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+14155552671')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jane-doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Some notes')).toBeInTheDocument();
  });

  it('does not submit when name is empty (validation blocks submit)', async () => {
    const user = userEvent.setup();
    render(
      <ContactForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );

    await user.type(screen.getByPlaceholderText(/john@example\.com/i), 'a');
    await user.click(screen.getByRole('button', { name: /create contact/i }));

    expect(mockCreateContact).not.toHaveBeenCalled();
  });

  it('shows validation error when no contact method provided', async () => {
    const user = userEvent.setup();
    render(
      <ContactForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );

    await user.type(screen.getByPlaceholderText(/john doe/i), 'John Doe');
    await user.click(screen.getByRole('button', { name: /create contact/i }));

    expect(
      screen.getByText(/at least one contact method/i)
    ).toBeInTheDocument();
    expect(mockCreateContact).not.toHaveBeenCalled();
  });

  it('shows validation error for invalid phone format', async () => {
    const user = userEvent.setup();
    render(
      <ContactForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );

    await user.type(screen.getByPlaceholderText(/john doe/i), 'John Doe');
    await user.type(screen.getByPlaceholderText(/\+14155552671/i), '123');
    await user.click(screen.getByRole('button', { name: /create contact/i }));

    expect(
      screen.getByText(/phone must be in E\.164 format/i)
    ).toBeInTheDocument();
    expect(mockCreateContact).not.toHaveBeenCalled();
  });

  it('calls createContact and redirects on valid submit in create mode', async () => {
    mockCreateContact.mockResolvedValue({ id: 1 });
    const user = userEvent.setup();
    render(
      <ContactForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );

    await user.type(screen.getByPlaceholderText(/john doe/i), 'John Doe');
    await user.type(screen.getByPlaceholderText(/john@example\.com/i), 'john@example.com');
    await user.click(screen.getByRole('button', { name: /create contact/i }));

    await vi.waitFor(() => {
      expect(mockCreateContact).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
          ownerIds: [CURRENT_USER_ID],
          primaryOwnerId: CURRENT_USER_ID,
        })
      );
    });
    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/contacts');
    });
  });

  it('calls updateContact and redirects on valid submit in edit mode', async () => {
    mockUpdateContact.mockResolvedValue({});
    const user = userEvent.setup();
    const contact = {
      id: 42,
      name: 'Jane',
      email: 'jane@example.com',
      isHidden: false,
      createdAt: '',
      updatedAt: '',
      owners: [],
    };
    render(
      <ContactForm mode="edit" currentUserId={CURRENT_USER_ID} contact={contact} />,
      { wrapper }
    );

    await user.clear(screen.getByDisplayValue('Jane'));
    await user.type(screen.getByPlaceholderText(/john doe/i), 'Jane Updated');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await vi.waitFor(() => {
      expect(mockUpdateContact).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          name: 'Jane Updated',
          email: 'jane@example.com',
        })
      );
    });
    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/contacts/42');
    });
  });

  it('navigates to contacts on Cancel in create mode', async () => {
    const user = userEvent.setup();
    render(
      <ContactForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockPush).toHaveBeenCalledWith('/contacts');
  });

  it('navigates to contact detail on Cancel in edit mode', async () => {
    const user = userEvent.setup();
    render(
      <ContactForm
        mode="edit"
        currentUserId={CURRENT_USER_ID}
        contact={{
          id: 10,
          name: 'Jane',
          isHidden: false,
          createdAt: '',
          updatedAt: '',
          owners: [],
        }}
      />,
      { wrapper }
    );
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockPush).toHaveBeenCalledWith('/contacts/10');
  });

  it('shows name required validation when name is empty', async () => {
    const user = userEvent.setup();
    render(
      <ContactForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );
    await user.click(screen.getByRole('button', { name: /create contact/i }));
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(mockCreateContact).not.toHaveBeenCalled();
  });

  it('calls createContact with phone only (no email) on valid submit', async () => {
    mockCreateContact.mockResolvedValue({ id: 2 });
    const user = userEvent.setup();
    render(
      <ContactForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );
    await user.type(screen.getByPlaceholderText(/john doe/i), 'Phone User');
    await user.type(screen.getByPlaceholderText(/\+14155552671/i), '+14155551234');
    await user.click(screen.getByRole('button', { name: /create contact/i }));

    await vi.waitFor(() => {
      expect(mockCreateContact).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Phone User',
          phone: '+14155551234',
          ownerIds: [CURRENT_USER_ID],
        })
      );
    });
    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/contacts');
    });
  });

  it('calls createContact with linkedinId only on valid submit', async () => {
    mockCreateContact.mockResolvedValue({ id: 3 });
    const user = userEvent.setup();
    render(
      <ContactForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );
    await user.type(screen.getByPlaceholderText(/john doe/i), 'LinkedIn User');
    await user.type(screen.getByPlaceholderText(/john-doe-123456/i), 'linkedin-id');
    await user.click(screen.getByRole('button', { name: /create contact/i }));

    await vi.waitFor(() => {
      expect(mockCreateContact).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'LinkedIn User',
          linkedinId: 'linkedin-id',
          ownerIds: [CURRENT_USER_ID],
        })
      );
    });
  });

  it('shows submit error when create fails', async () => {
    mockCreateContact.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    render(
      <ContactForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );
    await user.type(screen.getByPlaceholderText(/john doe/i), 'John');
    await user.type(screen.getByPlaceholderText(/john@example\.com/i), 'john@example.com');
    await user.click(screen.getByRole('button', { name: /create contact/i }));

    await vi.waitFor(() => {
      expect(screen.getByText(/server error|failed to create/i)).toBeInTheDocument();
    });
  });

  it('shows submit error when update fails', async () => {
    mockUpdateContact.mockRejectedValue(new Error('Update failed'));
    const user = userEvent.setup();
    render(
      <ContactForm
        mode="edit"
        currentUserId={CURRENT_USER_ID}
        contact={{
          id: 5,
          name: 'Jane',
          email: 'jane@example.com',
          isHidden: false,
          createdAt: '',
          updatedAt: '',
          owners: [],
        }}
      />,
      { wrapper }
    );
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await vi.waitFor(() => {
      expect(screen.getByText(/update failed|failed to update/i)).toBeInTheDocument();
    });
  });

  it('shows Saving... and disables buttons while submitting in create mode', async () => {
    let resolveCreate: (value: { id: number }) => void = () => {
      /* noop until Promise constructor runs */
    };
    mockCreateContact.mockImplementation(
      () =>
        new Promise<{ id: number }>((resolve) => {
          resolveCreate = resolve;
        })
    );
    const user = userEvent.setup();
    render(
      <ContactForm mode="create" currentUserId={CURRENT_USER_ID} />,
      { wrapper }
    );
    await user.type(screen.getByPlaceholderText(/john doe/i), 'John');
    await user.type(screen.getByPlaceholderText(/john@example\.com/i), 'john@example.com');
    await user.click(screen.getByRole('button', { name: /create contact/i }));

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
    });
    const submitBtn = screen.getByRole('button', { name: /saving/i });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

    if (resolveCreate) resolveCreate({ id: 1 });
    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/contacts');
    });
  });
});

const mockMetadata = [
  {
      id: "name",
      header: "Name",
      fieldType: "entity",
      dataType: "text",
      sortable: true,
      filterable: true,
      searchable: true,
      editable: true,
      isVisible: true,
      default: true,
      config: {
          entityType: "contact",
          hrefTemplate: "/contacts/{id}"
      }
  },
  {
      id: "email",
      header: "Email",
      fieldType: "text",
      dataType: "text",
      sortable: false,
      filterable: true,
      searchable: true,
      editable: true,
      isVisible: true,
      default: true,
      config: {
          render: "email",
          accessorKey: "email"
      }
  },
  {
      id: "phone",
      header: "Phone",
      fieldType: "text",
      dataType: "text",
      sortable: false,
      filterable: true,
      searchable: true,
      editable: true,
      isVisible: true,
      default: true,
      config: {
          render: "phone",
          accessorKey: "phone"
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
  phone: "+14155552671",
  linkedinId: "john-doe-123",
  notes: "test",
  isHidden: false,
  createdAt: {
      value: "2026-03-10T07:30:06.648Z",
      display: "10 Mar 2026"
  },
  updatedAt: "2026-03-10T07:30:06.648Z",
  owners: {
      value: {
          id: 1,
          contactId: 1,
          userId: 1,
          isPrimary: true,
          assignedAt: "2026-03-10T07:30:06.648Z",
          user: {
              id: 1,
              name: "Alice",
              email: "alice@example.com"
          }
      },
      display: "Alice"
  }
};

describe('ContactsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTableViewContacts.mockResolvedValue(emptyContactsResponse);
  });

  it('renders heading and description', () => {
    render(<ContactsList />, { wrapper });
    expect(screen.getByText('Contacts')).toBeInTheDocument();
    expect(
      screen.getByText(/manage your sales contacts and relationships/i)
    ).toBeInTheDocument();
  });

  it('renders search input with placeholder', () => {
    render(<ContactsList />, { wrapper });
    expect(
      screen.getByPlaceholderText(
        /search contacts by name, email, phone, or linkedin/i
      )
    ).toBeInTheDocument();
  });

  it('updates search input when user types', async () => {
    const user = userEvent.setup();
    render(<ContactsList />, { wrapper });
    const search = screen.getByPlaceholderText(
      /search contacts by name, email, phone, or linkedin/i
    );
    await user.type(search, 'john');
    expect(search).toHaveValue('john');
  });

  it('renders empty table when no contacts', async () => {
    render(<ContactsList />, { wrapper });
    await vi.waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
      // Headers should still be there
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
    });
    
    // The table body should have no data rows
    const tbody = screen.getByRole('table').querySelector('tbody');
    expect(tbody?.children.length).toBe(0);

    // button with add row label should be present
    expect(screen.getByRole('button', { name: /add row/i })).toBeInTheDocument();
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
      () => new Promise<never>(() => undefined) // never resolves
    );
    render(<ContactsList />, { wrapper });
    expect(screen.getByText(/loading contacts/i)).toBeInTheDocument();
  });

  it('calls getTableViewContacts with search param when user types in search', async () => {
    const user = userEvent.setup();
    render(<ContactsList />, { wrapper });
    const search = screen.getByPlaceholderText(
      /search contacts by name, email, phone, or linkedin/i
    );
    await user.type(search, 'alice');
    await vi.waitFor(() => {
      expect(mockGetTableViewContacts).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'alice' })
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
    expect(
      screen.getByText(/showing 1 of 42 contacts/i)
    ).toBeInTheDocument();
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
    await user.click(screen.getByLabelText('Add column'));
    
    // Verify the dialog title and input fields
    expect(screen.getByText('Add new field')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Field name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/unique column key/i)).toBeInTheDocument();
    expect(screen.getByText('Field Type')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create field/i })).toBeInTheDocument();
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
    vi.clearAllMocks();
    mockGetContact.mockResolvedValue(detailContact);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('shows loading state while fetching contact', () => {
    mockGetContact.mockImplementation(
      () => new Promise<never>(() => undefined)
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
    await vi.waitFor(() => {
      expect(screen.getByText('Detail Contact')).toBeInTheDocument();
    });
    expect(screen.getByText('detail@example.com')).toBeInTheDocument();
    expect(screen.getByText('+14155550000')).toBeInTheDocument();
    expect(screen.getByText('detail-linkedin')).toBeInTheDocument();
    expect(screen.getByText('Contact Information')).toBeInTheDocument();
    expect(screen.getByText('Owners')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Some notes here')).toBeInTheDocument();
  });

  it('navigates to edit page when Edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<ContactDetail contactId={7} currentUserId={1} />, { wrapper });
    await vi.waitFor(() => {
      expect(screen.getByText('Detail Contact')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(mockPush).toHaveBeenCalledWith('/contacts/7/edit');
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
      expect(screen.getByText(/are you sure you want to hide this contact/i)).toBeInTheDocument()
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
});



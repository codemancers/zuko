/**
 * @vitest-environment jsdom
 *
 * Tests that mutations in company/contact components correctly invalidate the
 * activity timeline query key so the timeline refreshes without a page reload.
 */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CompanyForm from '@/components/Companies/CompanyForm';
import CompanyDetail from '@/components/Companies/CompanyDetail';
import ContactForm from '@/components/Contacts/ContactForm';
import AddContactDialog from '@/components/Companies/AddContactDialog';
import TaskForm from '@/components/Tasks/TaskForm';

// ── Router ────────────────────────────────────────────────────────────────────
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ── API mocks ─────────────────────────────────────────────────────────────────
const mockUpdateCompany = vi.fn();
const mockGetCompany = vi.fn();
const mockRemoveContact = vi.fn();
const mockUpdateContact = vi.fn();
const mockAddContact = vi.fn();
vi.mock('@/lib/api/companies', () => ({
  companiesApi: {
    updateCompany: (...args: unknown[]) => mockUpdateCompany(...args),
    getCompany: (...args: unknown[]) => mockGetCompany(...args),
    hideCompany: vi.fn(),
    removeContact: (...args: unknown[]) => mockRemoveContact(...args),
    updateContact: (...args: unknown[]) => mockUpdateContact(...args),
    addContact: (...args: unknown[]) => mockAddContact(...args),
  },
}));

const mockUpdateContact2 = vi.fn();
const mockGetContacts = vi.fn();
vi.mock('@/lib/api/contacts', () => ({
  contactsApi: {
    updateContact: (...args: unknown[]) => mockUpdateContact2(...args),
    getContacts: (...args: unknown[]) => mockGetContacts(...args),
  },
}));

vi.mock('@/lib/api/deals', () => ({
  dealsApi: { getDealsByCompany: vi.fn(() => Promise.resolve({ deals: [] })) },
}));

const mockUpdateTask = vi.fn();
const mockGetTasks = vi.fn();
vi.mock('@/lib/api/tasks', () => ({
  tasksApi: {
    updateTask: (...args: unknown[]) => mockUpdateTask(...args),
    getTasks: (...args: unknown[]) => mockGetTasks(...args),
  },
}));

vi.mock('@/components/Activity/ActivityTimeline', () => ({
  default: () => <div data-testid="activity-timeline">Activity</div>,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
let queryClient: QueryClient;

function createWrapper() {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const mockCompany = {
  id: 42,
  companyName: 'Acme',
  website: 'https://acme.com',
  isHidden: false,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z',
  owners: [{ id: 1, userId: 1, companyId: 42, isPrimary: true, assignedAt: '', user: { id: 1, name: 'Alice', email: 'a@a.com' } }],
  contacts: [
    { id: 1, contactId: 5, companyId: 42, role: undefined, isPrimary: false, joinedAt: '2025-01-01T00:00:00Z', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z', contact: { id: 5, name: 'Jane Doe', email: 'jane@example.com', isHidden: false, createdAt: '', updatedAt: '', owners: [] } },
  ],
};

const mockContact = {
  id: 99,
  name: 'Bob Smith',
  email: 'bob@example.com',
  isHidden: false,
  createdAt: '',
  updatedAt: '',
  owners: [],
};

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.clearAllMocks();
  mockGetCompany.mockResolvedValue(mockCompany);
  mockGetContacts.mockResolvedValue({ contacts: [{ id: 10, name: 'Free Contact', email: 'free@test.com' }] });
  mockGetTasks.mockResolvedValue({ tasks: [] });
});

// ── CompanyForm ───────────────────────────────────────────────────────────────

describe('CompanyForm – timeline invalidation', () => {
  it('invalidates timeline query after a successful update', async () => {
    mockUpdateCompany.mockResolvedValue({});
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    render(
      <CompanyForm mode="edit" currentUserId={1} company={mockCompany} />,
      { wrapper: createWrapper() },
    );

    const nameInput = screen.getByPlaceholderText(/acme inc/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Acme Updated');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['timeline', 'company', 42] }),
      );
    });
  });
});

// ── ContactForm ───────────────────────────────────────────────────────────────

describe('ContactForm – timeline invalidation', () => {
  it('invalidates timeline query after a successful update', async () => {
    mockUpdateContact2.mockResolvedValue({});
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    render(
      <ContactForm mode="edit" currentUserId={1} contact={mockContact} />,
      { wrapper: createWrapper() },
    );

    const nameInput = screen.getByPlaceholderText(/john doe/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Bob Updated');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['timeline', 'contact', 99] }),
      );
    });
  });
});

// ── CompanyDetail – removeContact ─────────────────────────────────────────────

describe('CompanyDetail – removeContact timeline invalidation', () => {
  it('invalidates timeline query after removing a contact', async () => {
    mockRemoveContact.mockResolvedValue(undefined);
    mockGetCompany.mockResolvedValue({ ...mockCompany });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CompanyDetail companyId={42} currentUserId={1} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTitle('Remove contact'));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['timeline', 'company', 42] }),
      );
    });
  });
});

// ── CompanyDetail – updateContact ─────────────────────────────────────────────

describe('CompanyDetail – updateContact timeline invalidation', () => {
  it('invalidates timeline query after updating a contact association', async () => {
    mockUpdateContact.mockResolvedValue({});
    mockGetCompany.mockResolvedValue({ ...mockCompany });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(<CompanyDetail companyId={42} currentUserId={1} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTitle('Edit association'));

    // Save without changes (role is empty, isPrimary false)
    await user.click(screen.getByTitle('Save changes'));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['timeline', 'company', 42] }),
      );
    });
  });
});

// ── TaskForm ──────────────────────────────────────────────────────────────────

const mockTask = {
  id: 7,
  organizationId: 1,
  title: 'Fix bug',
  description: 'A bug to fix',
  status: 'TODO' as const,
  assignee: null,
  parentId: null,
  completedAt: null,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z',
  owners: [],
  subtasks: [],
};

describe('TaskForm – timeline invalidation', () => {
  it('invalidates timeline query after a successful update', async () => {
    mockUpdateTask.mockResolvedValue({ ...mockTask, title: 'Fix bug updated' });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    render(
      <TaskForm mode="edit" task={mockTask} />,
      { wrapper: createWrapper() },
    );

    const titleInput = screen.getByPlaceholderText(/task title/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Fix bug updated');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['timeline', 'task', 7] }),
      );
    });
  });
});

// ── AddContactDialog ──────────────────────────────────────────────────────────

describe('AddContactDialog – timeline invalidation', () => {
  it('invalidates timeline query after adding a contact', async () => {
    mockAddContact.mockResolvedValue({});
    // Pre-populate contacts cache so the dropdown renders without async fetch
    queryClient.setQueryData(['contacts', {}], {
      contacts: [{ id: 10, name: 'Free Contact', email: 'free@test.com' }],
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <AddContactDialog companyId={42} existingContactIds={[]} />,
      { wrapper: createWrapper() },
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /add contact/i }));

    // Wait for dialog to open and contact dropdown to populate
    await waitFor(() => {
      expect(screen.getByText(/add contact to company/i)).toBeInTheDocument();
    });

    // Select the first (only) available contact
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, '10');

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /add contact/i }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['timeline', 'company', 42] }),
      );
    });
  });
});

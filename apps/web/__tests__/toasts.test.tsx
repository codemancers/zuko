/**
 * @vitest-environment jsdom
 *
 * Unit tests verifying that toast notifications are fired correctly
 * in ContactForm, CompanyForm, DealForm, AddContactDialog,
 * AddCompanyToDealDialog, and AddContactToDealDialog.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import ContactForm from '@/components/Contacts/ContactForm';
import CompanyForm from '@/components/Companies/CompanyForm';
import DealForm from '@/components/Deals/DealForm';
import AddContactDialog from '@/components/Companies/AddContactDialog';
import AddCompanyToDealDialog from '@/components/Deals/AddCompanyToDealDialog';
import AddContactToDealDialog from '@/components/Deals/AddContactToDealDialog';

// ── sonner mock ────────────────────────────────────────────────────────────────
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ── next/navigation ────────────────────────────────────────────────────────────
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ── API mocks ──────────────────────────────────────────────────────────────────
const mockCreateContact = vi.fn();
const mockUpdateContact = vi.fn();
vi.mock('@/lib/api/contacts', () => ({
  contactsApi: {
    createContact: (...args: unknown[]) => mockCreateContact(...args),
    updateContact: (...args: unknown[]) => mockUpdateContact(...args),
  },
}));

const mockCreateCompany = vi.fn();
const mockUpdateCompany = vi.fn();
vi.mock('@/lib/api/companies', () => ({
  companiesApi: {
    createCompany: (...args: unknown[]) => mockCreateCompany(...args),
    updateCompany: (...args: unknown[]) => mockUpdateCompany(...args),
    addContact: (...args: unknown[]) => mockAddContactToCompany(...args),
  },
}));

const mockCreateDeal = vi.fn();
const mockUpdateDeal = vi.fn();
const mockAddCompanyToDeal = vi.fn();
const mockAddContactToDeal = vi.fn();
vi.mock('@/lib/api/deals', () => ({
  dealsApi: {
    createDeal: (...args: unknown[]) => mockCreateDeal(...args),
    updateDeal: (...args: unknown[]) => mockUpdateDeal(...args),
    addCompany: (...args: unknown[]) => mockAddCompanyToDeal(...args),
    addContact: (...args: unknown[]) => mockAddContactToDeal(...args),
  },
}));

// Declared before the vi.mock factory so the closure can close over it.
const mockAddContactToCompany = vi.fn();

// ── server/query-options mock (used by AddCompanyToDealDialog, AddContactToDealDialog, AddContactDialog) ──
vi.mock('@/server/query-options', () => ({
  getContacts: () => ({
    queryKey: ['contacts'],
    queryFn: async () => ({
      contacts: [
        { id: 10, name: 'Alice Smith', email: 'alice@example.com' },
        { id: 11, name: 'Bob Jones', email: 'bob@example.com' },
      ],
    }),
  }),
  getCompanies: () => ({
    queryKey: ['companies'],
    queryFn: async () => ({
      companies: [
        { id: 20, companyName: 'Acme Corp' },
        { id: 21, companyName: 'Globex' },
      ],
    }),
  }),
}));

// ── ui-kit mock ────────────────────────────────────────────────────────────────
vi.mock('@zuko/ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@zuko/ui-kit')>();
  return {
    ...actual,
    ErrorMessage: ({ children }: React.PropsWithChildren) =>
      React.createElement('p', { className: 'error-message' }, children),
    Description: ({ children }: React.PropsWithChildren) =>
      React.createElement('p', { className: 'description' }, children),
    Combobox: ({ options, onChange, placeholder }: any) => (
      <select
        data-testid="mock-combobox"
        aria-label={placeholder}
        defaultValue=""
        onChange={(e) => {
          const selected = options.find(
            (o: any) => String(o.code ?? o.value ?? o) === e.target.value,
          );
          if (selected) onChange(selected);
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o: any) => (
          <option key={o.code ?? o.value} value={o.code ?? o.value}>
            {o.code ?? o.label ?? String(o)}
          </option>
        ))}
      </select>
    ),
    ComboboxOption: ({ children }: any) => <>{children}</>,
    ComboboxLabel: ({ children }: any) => <>{children}</>,
    ComboboxDescription: ({ children }: any) => <>{children}</>,
  };
});

// ── helpers ────────────────────────────────────────────────────────────────────
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

// ── ContactForm ────────────────────────────────────────────────────────────────
describe('ContactForm toasts', () => {
  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
  });

  it('shows success toast after successful create', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    mockCreateContact.mockResolvedValue({ id: 1, name: 'Jane Doe' });

    render(
      <ContactForm mode="create" currentUserId={1} onSuccess={onSuccess} />,
      { wrapper },
    );

    await user.type(screen.getByPlaceholderText(/john doe/i), 'Jane Doe');
    await user.type(
      screen.getByPlaceholderText(/john@example\.com/i),
      'jane@example.com',
    );
    await user.click(screen.getByRole('button', { name: /create contact/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Contact created successfully',
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('shows error toast when create fails', async () => {
    const user = userEvent.setup();
    mockCreateContact.mockRejectedValue(new Error('Server error'));

    render(
      <ContactForm mode="create" currentUserId={1} onSuccess={vi.fn()} />,
      { wrapper },
    );

    await user.type(screen.getByPlaceholderText(/john doe/i), 'Jane Doe');
    await user.type(
      screen.getByPlaceholderText(/john@example\.com/i),
      'jane@example.com',
    );
    await user.click(screen.getByRole('button', { name: /create contact/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server error');
    });
  });

  it('shows success toast after successful update', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const existingContact = {
      id: 7,
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '',
      linkedinId: '',
    };
    mockUpdateContact.mockResolvedValue(existingContact);

    render(
      <ContactForm
        mode="edit"
        contact={existingContact as any}
        currentUserId={1}
        onSuccess={onSuccess}
      />,
      { wrapper },
    );

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Contact updated successfully',
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('shows error toast when update fails', async () => {
    const user = userEvent.setup();
    const existingContact = {
      id: 7,
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '',
      linkedinId: '',
    };
    mockUpdateContact.mockRejectedValue(new Error('Update failed'));

    render(
      <ContactForm
        mode="edit"
        contact={existingContact as any}
        currentUserId={1}
        onSuccess={vi.fn()}
      />,
      { wrapper },
    );

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Update failed');
    });
  });
});

// ── CompanyForm ────────────────────────────────────────────────────────────────
describe('CompanyForm toasts', () => {
  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
  });

  it('shows success toast after successful create', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    mockCreateCompany.mockResolvedValue({ id: 1, companyName: 'Acme' });

    render(
      <CompanyForm mode="create" currentUserId={1} onSuccess={onSuccess} />,
      { wrapper },
    );

    await user.type(screen.getByPlaceholderText(/acme inc\./i), 'Acme');
    await user.click(screen.getByRole('button', { name: /create company/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Company created successfully',
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('shows error toast when create fails', async () => {
    const user = userEvent.setup();
    mockCreateCompany.mockRejectedValue(new Error('Network error'));

    render(
      <CompanyForm mode="create" currentUserId={1} onSuccess={vi.fn()} />,
      { wrapper },
    );

    await user.type(screen.getByPlaceholderText(/acme inc\./i), 'Acme');
    await user.click(screen.getByRole('button', { name: /create company/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Network error');
    });
  });

  it('shows success toast after successful update', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const existingCompany = {
      id: 5,
      companyName: 'Acme',
      website: '',
      linkedinUrl: '',
    };
    mockUpdateCompany.mockResolvedValue(existingCompany);

    render(
      <CompanyForm
        mode="edit"
        company={existingCompany as any}
        currentUserId={1}
        onSuccess={onSuccess}
      />,
      { wrapper },
    );

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Company updated successfully',
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('shows error toast when update fails', async () => {
    const user = userEvent.setup();
    const existingCompany = {
      id: 5,
      companyName: 'Acme',
      website: '',
      linkedinUrl: '',
    };
    mockUpdateCompany.mockRejectedValue(new Error('Update failed'));

    render(
      <CompanyForm
        mode="edit"
        company={existingCompany as any}
        currentUserId={1}
        onSuccess={vi.fn()}
      />,
      { wrapper },
    );

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Update failed');
    });
  });
});

// ── DealForm ───────────────────────────────────────────────────────────────────
describe('DealForm toasts', () => {
  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
  });

  it('shows success toast after successful create', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    mockCreateDeal.mockResolvedValue({ id: 1, title: 'New Deal' });

    render(<DealForm mode="create" currentUserId={1} onSuccess={onSuccess} />, {
      wrapper,
    });

    await user.type(
      screen.getByPlaceholderText(/enterprise license agreement/i),
      'New Deal',
    );
    await user.click(screen.getByRole('button', { name: /create deal/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Deal created successfully');
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('shows error toast when create fails', async () => {
    const user = userEvent.setup();
    mockCreateDeal.mockRejectedValue(new Error('Server error'));

    render(<DealForm mode="create" currentUserId={1} onSuccess={vi.fn()} />, {
      wrapper,
    });

    await user.type(
      screen.getByPlaceholderText(/enterprise license agreement/i),
      'New Deal',
    );
    await user.click(screen.getByRole('button', { name: /create deal/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server error');
    });
  });

  it('shows success toast after successful update', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const existingDeal = {
      id: 3,
      title: 'Existing Deal',
      value: 5000,
      currency: 'USD',
      probability: 50,
      stage: 'prospecting',
      expectedCloseDate: '',
      source: '',
      priority: 2,
    };
    mockUpdateDeal.mockResolvedValue(existingDeal);

    render(
      <DealForm
        mode="edit"
        deal={existingDeal as any}
        currentUserId={1}
        onSuccess={onSuccess}
      />,
      { wrapper },
    );

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Deal updated successfully');
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('shows error toast when update fails', async () => {
    const user = userEvent.setup();
    const existingDeal = {
      id: 3,
      title: 'Existing Deal',
      value: 5000,
      currency: 'USD',
      probability: 50,
      stage: 'prospecting',
      expectedCloseDate: '',
      source: '',
      priority: 2,
    };
    mockUpdateDeal.mockRejectedValue(new Error('Update failed'));

    render(
      <DealForm
        mode="edit"
        deal={existingDeal as any}
        currentUserId={1}
        onSuccess={vi.fn()}
      />,
      { wrapper },
    );

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Update failed');
    });
  });
});

// ── AddContactDialog (Companies) ───────────────────────────────────────────────
describe('AddContactDialog toasts', () => {
  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
  });

  it('shows success toast after adding contact to company', async () => {
    const user = userEvent.setup();
    mockAddContactToCompany.mockResolvedValue({});

    render(<AddContactDialog companyId={5} existingContactIds={[]} />, {
      wrapper,
    });

    await user.click(screen.getByRole('button', { name: /add contact/i }));

    // Wait for contacts to load in the select
    const select = await screen.findByRole('combobox');
    await user.selectOptions(select, '10');

    await user.click(screen.getByRole('button', { name: /^add contact$/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Contact added to company');
    });
  });

  it('shows error toast when adding contact to company fails', async () => {
    const user = userEvent.setup();
    mockAddContactToCompany.mockRejectedValue(new Error('Failed to add'));

    render(<AddContactDialog companyId={5} existingContactIds={[]} />, {
      wrapper,
    });

    await user.click(screen.getByRole('button', { name: /add contact/i }));

    const select = await screen.findByRole('combobox');
    await user.selectOptions(select, '10');

    await user.click(screen.getByRole('button', { name: /^add contact$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to add');
    });
  });
});

// ── AddCompanyToDealDialog ─────────────────────────────────────────────────────
describe('AddCompanyToDealDialog toasts', () => {
  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
  });

  it('shows success toast after adding company to deal', async () => {
    const user = userEvent.setup();
    mockAddCompanyToDeal.mockResolvedValue({});

    render(<AddCompanyToDealDialog dealId={3} existingCompanyIds={[]} />, {
      wrapper,
    });

    await user.click(screen.getByRole('button', { name: /add company/i }));

    const select = await screen.findByRole('combobox');
    await user.selectOptions(select, '20');

    await user.click(screen.getByRole('button', { name: /^add company$/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Company added to deal');
    });
  });

  it('shows error toast when adding company to deal fails', async () => {
    const user = userEvent.setup();
    mockAddCompanyToDeal.mockRejectedValue(new Error('Failed to add'));

    render(<AddCompanyToDealDialog dealId={3} existingCompanyIds={[]} />, {
      wrapper,
    });

    await user.click(screen.getByRole('button', { name: /add company/i }));

    const select = await screen.findByRole('combobox');
    await user.selectOptions(select, '20');

    await user.click(screen.getByRole('button', { name: /^add company$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to add');
    });
  });
});

// ── AddContactToDealDialog ─────────────────────────────────────────────────────
describe('AddContactToDealDialog toasts', () => {
  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
  });

  it('shows success toast after adding contact to deal', async () => {
    const user = userEvent.setup();
    mockAddContactToDeal.mockResolvedValue({});

    render(<AddContactToDealDialog dealId={3} existingContactIds={[]} />, {
      wrapper,
    });

    await user.click(screen.getByRole('button', { name: /add contact/i }));

    const select = await screen.findByRole('combobox');
    await user.selectOptions(select, '10');

    await user.click(screen.getByRole('button', { name: /^add contact$/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Contact added to deal');
    });
  });

  it('shows error toast when adding contact to deal fails', async () => {
    const user = userEvent.setup();
    mockAddContactToDeal.mockRejectedValue(new Error('Failed to add'));

    render(<AddContactToDealDialog dealId={3} existingContactIds={[]} />, {
      wrapper,
    });

    await user.click(screen.getByRole('button', { name: /add contact/i }));

    const select = await screen.findByRole('combobox');
    await user.selectOptions(select, '10');

    await user.click(screen.getByRole('button', { name: /^add contact$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to add');
    });
  });
});

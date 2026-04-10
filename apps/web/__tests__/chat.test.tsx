/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@zuko/ui-kit';
import { ChatInput } from '@/components/Chat/ChatInput';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  getStatusBadge,
} from '@/components/Chat/Tool';
import NewChatPage from '@/app/(app)/chat/page';
import { contactsApi } from '@/lib/api/contacts';
import { companiesApi } from '@/lib/api/companies';
import { dealsApi } from '@/lib/api/deals';

// Mock next/navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock('@/lib/api/contacts', () => ({
  contactsApi: {
    getContacts: vi.fn(() =>
      Promise.resolve({
        contacts: [],
        pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
      })
    ),
  },
}));

vi.mock('@/lib/api/companies', () => ({
  companiesApi: {
    getCompanies: vi.fn(() =>
      Promise.resolve({
        companies: [],
        pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
      })
    ),
  },
}));

vi.mock('@/lib/api/deals', () => ({
  dealsApi: {
    getDeals: vi.fn(() =>
      Promise.resolve({
        deals: [],
        pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
      })
    ),
  },
}));

// jsdom does not provide ResizeObserver (needed by Radix dropdown when menu opens)
vi.stubGlobal(
  'ResizeObserver',
  class ResizeObserver {
    // Minimal no-op implementations to satisfy the linter
    observe() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
  },
);

// Mock Speech Recognition so ChatInput's useEffect doesn't throw in jsdom
beforeEach(() => {
  const MockSpeechRecognition = vi.fn().mockImplementation(function (this: any) {
    this.start = vi.fn();
    this.stop = vi.fn();
    this.continuous = true;
    this.interimResults = true;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
  });
  (window as any).webkitSpeechRecognition = MockSpeechRecognition;
  (window as any).SpeechRecognition = MockSpeechRecognition;
});

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
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}

describe('ChatInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default placeholder', () => {
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    expect(
      screen.getByPlaceholderText(/ask anything.*try typing @/i)
    ).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    const onSubmit = vi.fn();
    render(
      <ChatInput onSubmit={onSubmit} placeholder="Type your message..." />,
      { wrapper }
    );

    expect(
      screen.getByPlaceholderText(/type your message/i)
    ).toBeInTheDocument();
  });

  it('renders Submit button', () => {
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('renders footer with Submit, Search, and Voice buttons', () => {
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton).toBeInTheDocument();

    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).toBeInTheDocument();

    // Voice button is identified by its tooltip which sets accessibility name or checking for svg
    const buttons = screen.getAllByRole('button');
    // In PromptInputButton, the tooltip string is often passed as a title, aria-label, or we can just look for the Mic icon's container.
    // If testing-library doesn't see "Voice input" text, we'll fall back to checking if there is a button that contains an SVG but doesn't have "Submit" or "Search" text. 
    // Usually the tooltip component adds the label, so let's try getting it by name, but just in case we can use querySelector('svg').
    // Since there are only a few buttons: attachments, web search, voice, submit.
    // Tooltip="Voice input"
    const voiceButton = buttons.find((btn) => btn.querySelector('svg') && !btn.textContent);
    expect(voiceButton).toBeDefined();
    expect(voiceButton).toBeInTheDocument();

    expect(buttons.length).toBeGreaterThanOrEqual(4);
  });

  it('calls onSubmit with text when user types and submits', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i);
    await user.type(input, 'Hello');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Hello' })
      );
    });
  });

  it('does not submit when input is empty', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables input when disabled prop is true', () => {
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} disabled />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i);
    expect(input).toBeDisabled();
  });

  it('submits on Shift+Enter when text is present', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i);
    await user.type(input, 'Shift enter message');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Shift enter message' })
      );
    });
  });

  it('does not submit when input is only whitespace', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i);
    await user.type(input, '   ');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears input after successful submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i) as HTMLTextAreaElement;
    await user.type(input, 'Hello');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('does not clear input when onSubmit rejects', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('Send failed'));
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i) as HTMLTextAreaElement;
    await user.type(input, 'Failed message');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(input.value).toBe('Failed message');
    });
  });

  it('user can open action menu and see attachment option', async () => {
    const user = userEvent.setup();
    render(<ChatInput onSubmit={vi.fn()} />, { wrapper });

    const menuTrigger = screen
      .getAllByRole('button')
      .find((el) => el.getAttribute('aria-haspopup') === 'menu');
    if (!menuTrigger) throw new Error('Action menu trigger not found');
    await user.click(menuTrigger);

    await waitFor(() => {
      expect(screen.getByText(/add photos or files/i)).toBeInTheDocument();
    });
  });

  it('clicking Search button triggers web search handler', async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    render(<ChatInput onSubmit={vi.fn()} />, { wrapper });

    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Web search feature - to be implemented'
      );
    });
    alertSpy.mockRestore();
  });

  it('user can send a message by typing and clicking Submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i);
    await user.type(input, 'My message');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'My message' })
      );
    });
  });

  it('shows Stop button and calls onStop when status is streaming', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    render(
      <ChatInput onSubmit={vi.fn()} status="streaming" onStop={onStop} />,
      { wrapper }
    );

    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /stop/i }));
    expect(onStop).toHaveBeenCalled();
  });

  it('shows Stop button when status is submitted', () => {
    render(
      <ChatInput onSubmit={vi.fn()} status="submitted" />,
      { wrapper }
    );
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
  });

  it('accepts initialContext and renders with it', () => {
    const onSubmit = vi.fn();
    const initialContext = [
      { type: 'contact' as const, id: 1, name: 'Pre-loaded Contact', metadata: { type: 'contact', entityId: 1 } },
    ];
    render(
      <ChatInput onSubmit={onSubmit} initialContext={initialContext} />,
      { wrapper }
    );
    expect(screen.getByPlaceholderText(/ask anything.*try typing @/i)).toBeInTheDocument();
    expect(screen.getByText('Pre-loaded Contact')).toBeInTheDocument();
  });
});

describe('ChatInput mentions', () => {
  const mockContacts = [
    {
      id: 1,
      name: 'Alice Smith',
      email: 'alice@example.com',
      phone: '',
      isHidden: false,
      createdAt: '',
      updatedAt: '',
      owners: [],
    },
  ];
  const mockCompanies = [
    {
      id: 10,
      companyName: 'Acme Inc',
      website: 'https://acme.com',
      isHidden: false,
      createdAt: '',
      updatedAt: '',
      owners: [],
    },
  ];
  const mockDeals = [
    {
      id: 100,
      title: 'Enterprise License',
      stage: 'Negotiation',
      value: 50000,
      currency: 'USD',
      isHidden: false,
      createdAt: '',
      updatedAt: '',
      owners: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(contactsApi.getContacts).mockResolvedValue({
      contacts: mockContacts,
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    vi.mocked(companiesApi.getCompanies).mockResolvedValue({
      companies: mockCompanies,
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    vi.mocked(dealsApi.getDeals).mockResolvedValue({
      deals: mockDeals,
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
  });

  it('shows contact suggestions when typing @', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i);
    await user.click(input);
    // Min 3 chars after @ to show suggestions
    await user.keyboard('@ali');

    await waitFor(
      () => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('shows company suggestions when typing @', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i);
    await user.click(input);
    // Min 3 chars after @ to show suggestions
    await user.keyboard('@acm');

    await waitFor(
      () => {
        expect(screen.getByText('Acme Inc')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('calls onSubmit with contact mention in contextEntities when user selects a contact and submits', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i);
    await user.click(input);
    await user.keyboard('@ali');

    await waitFor(
      () => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    await user.click(screen.getByText('Alice Smith'));

    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringMatching(/alice smith/i),
          metadata: {
            contextEntities: [{ type: 'contact', id: 1 }],
          },
        })
      );
    });
  });

  it('calls onSubmit with company mention in contextEntities when user selects a company and submits', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i);
    await user.click(input);
    await user.keyboard('@acm');

    await waitFor(
      () => {
        expect(screen.getByText('Acme Inc')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    await user.click(screen.getByText('Acme Inc'));

    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringMatching(/acme inc/i),
          metadata: {
            contextEntities: [{ type: 'company', id: 10 }],
          },
        })
      );
    });
  });

  it('shows deal suggestions when typing @', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i);
    await user.click(input);
    await user.keyboard('@ent');

    await waitFor(
      () => {
        expect(screen.getByText('Enterprise License')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('calls onSubmit with deal mention in contextEntities when user selects a deal and submits', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i);
    await user.click(input);
    await user.keyboard('@ent');

    await waitFor(
      () => {
        expect(screen.getByText('Enterprise License')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    await user.click(screen.getByText('Enterprise License'));

    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringMatching(/enterprise license/i),
          metadata: {
            contextEntities: [{ type: 'deal', id: 100 }],
          },
        })
      );
    });
  });

  it('calls onSubmit with both contact and company mentions in contextEntities', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i);
    await user.click(input);
    await user.keyboard('@ali');

    await waitFor(
      () => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    await user.click(screen.getByText('Alice Smith'));

    await user.keyboard(' and @acm');
    await waitFor(
      () => {
        expect(screen.getByText('Acme Inc')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    await user.click(screen.getByText('Acme Inc'));

    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      const call = onSubmit.mock.calls[0][0];
      expect(call.metadata?.contextEntities).toHaveLength(2);
      expect(call.metadata?.contextEntities).toContainEqual({
        type: 'contact',
        id: 1,
      });
      expect(call.metadata?.contextEntities).toContainEqual({
        type: 'company',
        id: 10,
      });
    });
  });

  it('calls onSubmit with contact, company and deal mentions in contextEntities', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i);
    await user.click(input);
    await user.keyboard('@ali');

    await waitFor(
      () => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    await user.click(screen.getByText('Alice Smith'));

    await user.keyboard(' @acm');
    await waitFor(
      () => {
        expect(screen.getByText('Acme Inc')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    await user.click(screen.getByText('Acme Inc'));

    await user.keyboard(' @ent');
    await waitFor(
      () => {
        expect(screen.getByText('Enterprise License')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    await user.click(screen.getByText('Enterprise License'));

    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      const call = onSubmit.mock.calls[0][0];
      expect(call.metadata?.contextEntities).toHaveLength(3);
      expect(call.metadata?.contextEntities).toContainEqual({
        type: 'contact',
        id: 1,
      });
      expect(call.metadata?.contextEntities).toContainEqual({
        type: 'company',
        id: 10,
      });
      expect(call.metadata?.contextEntities).toContainEqual({
        type: 'deal',
        id: 100,
      });
    });
  });

  it('filters contact suggestions by search after @', async () => {
    vi.mocked(contactsApi.getContacts).mockResolvedValue({
      contacts: [
        ...mockContacts,
        {
          id: 2,
          name: 'Bob Jones',
          email: 'bob@example.com',
          phone: '',
          isHidden: false,
          createdAt: '',
          updatedAt: '',
          owners: [],
        },
      ],
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
    });
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ChatInput onSubmit={onSubmit} />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i);
    await user.click(input);
    await user.keyboard('@alice');

    await waitFor(
      () => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument();
  });
});

describe('Tool component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool', () => {
    it('renders with data-slot and data-state closed by default', () => {
      render(
        <Tool>
          <span>Child</span>
        </Tool>,
        { wrapper }
      );
      const container = screen.getByText('Child').closest('[data-slot="tool"]');
      expect(container).toBeInTheDocument();
      expect(container).toHaveAttribute('data-state', 'closed');
    });

    it('renders with data-state open when defaultOpen is true', () => {
      render(
        <Tool defaultOpen>
          <span>Child</span>
        </Tool>,
        { wrapper }
      );
      const container = screen.getByText('Child').closest('[data-slot="tool"]');
      expect(container).toHaveAttribute('data-state', 'open');
    });

    it('applies custom className', () => {
      render(
        <Tool className="custom-class">
          <span>Child</span>
        </Tool>,
        { wrapper }
      );
      const container = screen.getByText('Child').closest('[data-slot="tool"]');
      expect(container).toHaveClass('custom-class');
    });
  });

  describe('ToolHeader', () => {
    it('shows toolName for type dynamic-tool', () => {
      render(
        <Tool>
          <ToolHeader
            type="dynamic-tool"
            state="output-available"
            toolName="Search"
          />
        </Tool>,
        { wrapper }
      );
      expect(screen.getByText('Search')).toBeInTheDocument();
    });

    it('shows title when provided', () => {
      render(
        <Tool>
          <ToolHeader
            type="tool-invocation"
            state="input-available"
            title="Custom title"
          />
        </Tool>,
        { wrapper }
      );
      expect(screen.getByText('Custom title')).toBeInTheDocument();
    });

    it('shows status badge for state', () => {
      render(
        <Tool>
          <ToolHeader
            type="dynamic-tool"
            state="output-available"
            toolName="Test"
          />
        </Tool>,
        { wrapper }
      );
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('toggles ToolContent visibility when clicked', async () => {
      const user = userEvent.setup();
      render(
        <Tool>
          <ToolHeader
            type="dynamic-tool"
            state="output-available"
            toolName="Toggle"
          />
          <ToolContent>Content inside</ToolContent>
        </Tool>,
        { wrapper }
      );
      expect(screen.queryByText('Content inside')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /toggle/i }));
      expect(screen.getByText('Content inside')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /toggle/i }));
      expect(screen.queryByText('Content inside')).not.toBeInTheDocument();
    });
  });

  describe('ToolContent', () => {
    it('does not render when Tool is closed', () => {
      render(
        <Tool defaultOpen={false}>
          <ToolHeader
            type="dynamic-tool"
            state="output-available"
            toolName="Test"
          />
          <ToolContent>Hidden content</ToolContent>
        </Tool>,
        { wrapper }
      );
      expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
    });

    it('renders children when Tool is open', () => {
      render(
        <Tool defaultOpen>
          <ToolContent>Visible content</ToolContent>
        </Tool>,
        { wrapper }
      );
      expect(screen.getByText('Visible content')).toBeInTheDocument();
    });
  });

  describe('ToolInput', () => {
    it('renders Parameters heading and formatted input JSON', () => {
      const input = { query: 'test', limit: 10 };
      render(
        <Tool defaultOpen>
          <ToolContent>
            <ToolInput input={input} />
          </ToolContent>
        </Tool>,
        { wrapper }
      );
      expect(screen.getByText('Parameters')).toBeInTheDocument();
      expect(screen.getByText(/"query":/)).toBeInTheDocument();
      expect(screen.getByText(/"test"/)).toBeInTheDocument();
      expect(screen.getByText(/"limit":/)).toBeInTheDocument();
      expect(screen.getByText(/10/)).toBeInTheDocument();
    });
  });

  describe('ToolOutput', () => {
    it('returns null when output and errorText are falsy', () => {
      render(
        <Tool defaultOpen>
          <ToolContent>
            <ToolOutput output={undefined} errorText={undefined} />
          </ToolContent>
        </Tool>,
        { wrapper }
      );
      expect(screen.queryByText('Result')).not.toBeInTheDocument();
      expect(screen.queryByText('Error')).not.toBeInTheDocument();
    });

    it('shows Result heading and output when output is provided', () => {
      render(
        <Tool defaultOpen>
          <ToolContent>
            <ToolOutput output={{ count: 5 }} errorText={undefined} />
          </ToolContent>
        </Tool>,
        { wrapper }
      );
      expect(screen.getByText('Result')).toBeInTheDocument();
      expect(screen.getByText(/"count":/)).toBeInTheDocument();
      expect(screen.getByText(/5/)).toBeInTheDocument();
    });

    it('shows Error heading and errorText when errorText is provided', () => {
      render(
        <Tool defaultOpen>
          <ToolContent>
            <ToolOutput
              output={undefined}
              errorText="Something went wrong"
            />
          </ToolContent>
        </Tool>,
        { wrapper }
      );
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders string output as plain text when not valid JSON', () => {
      render(
        <Tool defaultOpen>
          <ToolContent>
            <ToolOutput output="Plain text result" errorText={undefined} />
          </ToolContent>
        </Tool>,
        { wrapper }
      );
      expect(screen.getByText('Result')).toBeInTheDocument();
      expect(screen.getByText('Plain text result')).toBeInTheDocument();
    });
  });

  describe('getStatusBadge', () => {
    it('renders badge for output-available state', () => {
      render(<>{getStatusBadge('output-available')}</>, { wrapper });
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('renders badge for output-error state', () => {
      render(<>{getStatusBadge('output-error')}</>, { wrapper });
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('renders badge for approval-requested state', () => {
      render(<>{getStatusBadge('approval-requested')}</>, { wrapper });
      expect(screen.getByText('Awaiting Approval')).toBeInTheDocument();
    });
  });
});

describe('NewChatPage', () => {
  const originalFetch = globalThis.fetch;
  const store: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(store).forEach((k) => delete store[k]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
      get length() {
        return Object.keys(store).length;
      },
      key: () => null,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders heading and description', () => {
    render(<NewChatPage />, { wrapper });

    expect(screen.getByText('Start a conversation')).toBeInTheDocument();
    expect(
      screen.getByText(/ask me anything to get started/i)
    ).toBeInTheDocument();
  });

  it('renders ChatInput', () => {
    render(<NewChatPage />, { wrapper });

    expect(
      screen.getByPlaceholderText(/ask anything.*try typing @/i)
    ).toBeInTheDocument();
  });

  it('creates chat and redirects with message stored in localStorage on submit', async () => {
    const user = userEvent.setup();
    const mockChatId = 'chat-123';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: mockChatId }),
    }) as any;

    render(<NewChatPage />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i);
    await user.type(input, 'First message');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/proxy/api/chats',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(`/chat/${mockChatId}`);
    });
    const stored = localStorage.getItem(`chat-${mockChatId}-firstMessage`);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.text).toBe('First message');
    expect(parsed.contextEntities).toEqual([]);
  });

  it('stores contextEntities in localStorage when submitting with mentions', async () => {
    vi.mocked(contactsApi.getContacts).mockResolvedValue({
      contacts: [{ id: 1, name: 'Alice', email: 'a@b.com', phone: '', isHidden: false, createdAt: '', updatedAt: '', owners: [] }],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    vi.mocked(companiesApi.getCompanies).mockResolvedValue({
      companies: [],
      pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
    });
    const user = userEvent.setup();
    const mockChatId = 'chat-456';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: mockChatId }),
    }) as any;

    render(<NewChatPage />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i);
    await user.click(input);
    await user.keyboard('@ali');
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    await user.click(screen.getByText('Alice'));
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(`/chat/${mockChatId}`);
    });
    const stored = localStorage.getItem(`chat-${mockChatId}-firstMessage`);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.contextEntities).toEqual([{ type: 'contact', id: 1 }]);
  });

  it('does not redirect when create chat fetch fails', async () => {
    const user = userEvent.setup();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as any;

    render(<NewChatPage />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i);
    await user.type(input, 'Will fail');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('disables ChatInput while submitting', async () => {
    let resolveFetch: (value: any) => void;
    const fetchPromise = new Promise<any>((resolve) => {
      resolveFetch = resolve;
    });
    globalThis.fetch = vi.fn().mockReturnValue(fetchPromise) as any;

    const user = userEvent.setup();
    render(<NewChatPage />, { wrapper });

    const input = screen.getByPlaceholderText(/ask anything.*try typing @/i);
    await user.type(input, 'Slow');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(input).toBeDisabled();
    });

    resolveFetch!({ ok: true, json: () => Promise.resolve({ id: 'slow-chat' }) });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/chat/slow-chat');
    });
  });
});

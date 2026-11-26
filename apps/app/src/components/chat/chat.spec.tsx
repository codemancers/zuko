import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { render } from '@/test/render';
import { auth, resetAuth } from '@/test/auth-mock';
import { organizationSetupKey } from '@/lib/organization-setup';
import { Chat } from './chat';

const mocks = vi.hoisted(() => ({ agent: vi.fn<() => unknown>() }));
vi.mock('next/navigation', async () => (await import('@/test/navigation-mock')).navigationModule);
vi.mock('@/lib/auth-client', async () => (await import('@/test/auth-mock')).authClientModule);
vi.mock('eve/react', () => ({ useEveAgent: mocks.agent }));
vi.mock('eve/events', () => ({ activeTurn: () => null, activity: () => ({ kind: 'idle' }) }));
vi.mock('@/components/dashboard/shell', () => ({
  Shell: ({ children }: { children: React.ReactNode }) => children,
}));

beforeEach(() => {
  resetAuth();
  mocks.agent.mockReset();
  auth.session = { data: { user: { id: '7' } }, isPending: false };
  auth.activeOrg = { data: { id: '11', name: 'Acme' }, isPending: false };
  mocks.agent.mockReturnValue({ messages: [], status: 'idle', view: null });
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ status: 'running', message: 'Preparing organization…' })));
});

function CompleteSetup() {
  const client = useQueryClient();
  return <button onClick={() => client.setQueryData(organizationSetupKey('11', '7'), { status: 'ready', message: 'Ready' })}>Complete setup</button>;
}

it('does not initialize or resume Eve until the cached organization readiness becomes ready', async () => {
  render(<><Chat sessionId="existing-chat" /><CompleteSetup /></>);
  expect(await screen.findByText('Chat will be available when organization setup is complete.')).toBeTruthy();
  expect(mocks.agent).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Complete setup' }));
  expect(await screen.findByText('Zuko copilot')).toBeTruthy();
  expect(mocks.agent).toHaveBeenCalledWith(expect.objectContaining({
    initialSession: { sessionId: 'existing-chat', streamIndex: 0 },
    resume: true,
  }));
  expect(fetch).toHaveBeenCalledTimes(1);
});

describe('attaching files', () => {
  const BACKEND = 'http://localhost:3000';
  const stored = { id: '42', filename: 'contract.pdf', media_type: 'application/pdf', size: 2048 };
  const send = vi.fn<(message: unknown) => Promise<unknown>>();

  function setupReady(messages: unknown[] = []) {
    send.mockReset();
    mocks.agent.mockReturnValue({ messages, status: 'idle', view: null, send, respond: vi.fn<() => void>(), cancel: vi.fn<() => void>() });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) =>
        String(url).endsWith('/api/v1/files') && init?.method === 'POST'
          ? Response.json(stored, { status: 201 })
          : Response.json({ status: 'ready', message: 'Ready' }),
      ),
    );
  }

  async function open() {
    render(<Chat />);
    await screen.findByText('Zuko copilot');
  }
  const pick = async (name = 'contract.pdf') => {
    const file = new File(['%PDF-1.7 x'], name, { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file] } });
    return screen.findByRole('list', { name: 'Attached files' });
  };

  it('uploads first, then sends only the file link, never its contents', async () => {
    setupReady();
    send.mockResolvedValue({});
    await open();
    const list = await pick();
    expect(list.textContent).toContain('contract.pdf');
    const posted = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST');
    expect(posted?.[1]?.body).toBeInstanceOf(FormData);

    fireEvent.change(screen.getByLabelText('Message Zuko copilot'), { target: { value: 'Summarize this' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    const message = send.mock.calls[0][0];
    expect(message).toEqual([
      { type: 'text', text: 'Summarize this' },
      { type: 'file', mediaType: 'application/pdf', filename: 'contract.pdf', data: `${BACKEND}/api/v1/files/42/content` },
    ]);
    expect(JSON.stringify(message)).not.toMatch(/data:|base64/);
    expect(screen.queryByRole('list', { name: 'Attached files' })).toBeNull();
  });

  it('can send files with no text, and plain text stays a plain string', async () => {
    setupReady();
    send.mockResolvedValue({});
    await open();
    await pick();
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0][0]).toEqual([expect.objectContaining({ type: 'file', filename: 'contract.pdf' })]);

    fireEvent.change(screen.getByLabelText('Message Zuko copilot'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls[1][0]).toBe('hello');
  });

  it('does not send an empty message', async () => {
    setupReady();
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(send).not.toHaveBeenCalled();
  });

  it('removes an attachment before sending', async () => {
    setupReady();
    await open();
    await pick();
    fireEvent.click(screen.getByRole('button', { name: 'Remove contract.pdf' }));
    expect(screen.queryByRole('list', { name: 'Attached files' })).toBeNull();
  });

  it('keeps the text and the files, and shows the reason, when the message is refused', async () => {
    setupReady();
    send.mockRejectedValue(new Error('File "contract.pdf" must be uploaded to Zuko first'));
    await open();
    await pick();
    const box = screen.getByLabelText('Message Zuko copilot') as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'Please read' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect((await screen.findByRole('alert')).textContent).toContain('must be uploaded to Zuko first');
    expect(box.value).toBe('Please read');
    expect((await screen.findByRole('list', { name: 'Attached files' })).textContent).toContain('contract.pdf');
  });

  it('shows the server\'s reason when an upload is refused, and attaches nothing', async () => {
    setupReady();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) =>
        init?.method === 'POST'
          ? Response.json({ message: 'The file is empty', code: 'EMPTY_FILE' }, { status: 400 })
          : Response.json({ status: 'ready', message: 'Ready' }),
      ),
    );
    await open();
    fireEvent.change(screen.getByTestId('file-input'), {
      target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] },
    });
    expect((await screen.findByRole('alert')).textContent).toContain('The file is empty');
    expect(screen.queryByRole('list', { name: 'Attached files' })).toBeNull();
  });

  it('refuses a file over 25 MB before uploading it', async () => {
    setupReady();
    await open();
    const big = new File(['x'], 'big.bin');
    Object.defineProperty(big, 'size', { value: 25 * 1024 * 1024 + 1 });
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [big] } });
    expect((await screen.findByRole('alert')).textContent).toContain('larger than 25 MB');
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('shows a stored file in a message as a link to it, and other attachments by name', async () => {
    setupReady([
      {
        id: 'm1',
        role: 'user',
        parts: [
          { type: 'text', text: 'Look' },
          { type: 'file', mediaType: 'application/pdf', filename: 'contract.pdf', size: 2048, url: `${BACKEND}/api/v1/files/42/content` },
          { type: 'file', mediaType: 'image/png', filename: 'elsewhere.png', url: 'https://example.com/elsewhere.png' },
          { type: 'file', mediaType: 'text/csv', filename: 'inline.csv' },
          { type: 'file', mediaType: 'text/csv', filename: 'lookalike.csv', url: `${BACKEND}/api/v1/files/7/content?x=1` },
        ],
      },
    ]);
    await open();
    const link = await screen.findByRole('link', { name: 'contract.pdf' });
    expect(link.getAttribute('href')).toBe(`${BACKEND}/api/v1/files/42/content`);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.includes('/files/'))).toHaveLength(1);
    for (const name of ['elsewhere.png', 'inline.csv', 'lookalike.csv'])
      expect(screen.getByText(`Attachment: ${name}`)).toBeTruthy();
  });
});

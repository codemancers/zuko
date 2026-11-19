import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/render';
import { Connections, type Connection } from './connections';

const api = vi.hoisted(() => vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>());
vi.mock('@/lib/api', () => ({ api, MCP_URL: 'http://localhost:3000/api/mcp' }));

const claude: Connection = {
  id: '1',
  client: { id: 'client_1', name: 'Claude', uri: null },
  organization: { id: '10', name: 'Acme' },
  scopes: ['openid', 'offline_access', 'mcp:read', 'mcp:write'],
  connected_at: '2026-11-03T10:00:00.000Z',
};
const cursor: Connection = {
  id: '2',
  client: { id: 'client_2', name: null, uri: null },
  organization: null,
  scopes: ['mcp:read'],
  connected_at: '2026-11-10T10:00:00.000Z',
};

function serve(results: Connection[]) {
  api.mockImplementation(async (path, init) =>
    init?.method === 'DELETE' ? { id: path.split('/').pop(), deleted: true } : { results },
  );
}

// A block body: vitest calls any function a beforeEach returns as a teardown, and mockReset returns the mock.
beforeEach(() => {
  api.mockReset();
});

describe('Connections', () => {
  it('lists each app with where it works and what it can do, without the plumbing scopes', async () => {
    serve([claude]);
    render(<Connections />);

    expect(await screen.findByText('Claude')).toBeTruthy();
    expect(screen.getByText('Acme')).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /Application/ })).toBeTruthy();
    expect(screen.getByText('View records and how your data is set up')).toBeTruthy();
    expect(screen.getByText('Create and change records')).toBeTruthy();
    expect(screen.queryByText('Know who you are')).toBeNull();
    expect(screen.queryByText('Stay connected without asking you again')).toBeNull();
    expect(api).toHaveBeenCalledWith(
      '/api/v1/connections',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('copes with an app that has no name and an organization the person has left', async () => {
    serve([cursor]);
    render(<Connections />);

    expect(await screen.findByText('Unnamed application')).toBeTruthy();
    expect(screen.getByText(/An organization you no longer have/)).toBeTruthy();
  });

  it('tells a new person how to connect an app when there are none', async () => {
    serve([]);
    render(<Connections />);

    expect(await screen.findByText('No connected apps')).toBeTruthy();
    expect(screen.getByText('http://localhost:3000/api/mcp')).toBeTruthy();
  });

  it('asks before disconnecting, and can be backed out of', async () => {
    serve([claude]);
    render(<Connections />);
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));

    expect(screen.getByText(/will stop working right away/)).toBeTruthy();
    expect(api).not.toHaveBeenCalledWith('/api/v1/connections/1', expect.anything());

    fireEvent.click(screen.getByRole('button', { name: 'Keep connected' }));
    expect(screen.queryByText(/will stop working right away/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy();
  });

  it('disconnects once confirmed and drops the row', async () => {
    serve([claude, cursor]);
    render(<Connections />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Disconnect' }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, disconnect' }));

    await waitFor(() => expect(screen.queryByText('Claude')).toBeNull());
    expect(api).toHaveBeenCalledWith('/api/v1/connections/1', { method: 'DELETE' });
    expect(screen.getByText('Unnamed application')).toBeTruthy(); // the other one stays
  });

  it('shows why a disconnect failed and keeps the app listed', async () => {
    api.mockImplementation(async (_path, init) => {
      if (init?.method === 'DELETE') throw new Error('No such connection');
      return { results: [claude] };
    });
    render(<Connections />);
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, disconnect' }));

    expect(await screen.findByText('No such connection')).toBeTruthy();
    expect(screen.getByText('Claude')).toBeTruthy();

    serve([claude]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, disconnect' }));
    await waitFor(() => expect(screen.queryByText('Claude')).toBeNull());
    expect(screen.queryByText('No such connection')).toBeNull();
  });

  it('disables actions while disconnecting and keeps the row until the server succeeds', async () => {
    let finish!: () => void;
    api.mockImplementation(async (_path, init) => {
      if (init?.method === 'DELETE')
        return new Promise<void>((resolve) => {
          finish = resolve;
        });
      return { results: [claude, cursor] };
    });
    render(<Connections />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Disconnect' }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, disconnect' }));

    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Disconnecting…' }) as HTMLButtonElement).disabled,
      ).toBe(true),
    );
    expect((screen.getByRole('button', { name: 'Disconnect' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole('button', { name: 'Keep connected' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText('Claude')).toBeTruthy();

    await act(async () => finish());
    await waitFor(() => expect(screen.queryByText('Claude')).toBeNull());
    expect((screen.getByRole('button', { name: 'Disconnect' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('shows an error when the list cannot be loaded', async () => {
    api.mockImplementation(async () => {
      throw new Error('Unauthorized');
    });
    render(<Connections />);

    expect(await screen.findByText('Unauthorized')).toBeTruthy();
    expect(screen.queryByText('No connected apps')).toBeNull();
  });
});

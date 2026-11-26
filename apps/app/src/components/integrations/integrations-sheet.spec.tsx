import { fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/render';
import { IntegrationsSheet } from './integrations-sheet';

const api = vi.hoisted(() => vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>());
vi.mock('@/lib/api', () => ({ api }));

const params = vi.hoisted(() => ({ current: new URLSearchParams() }));
const replace = vi.hoisted(() => vi.fn<(url: string, options?: object) => void>());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/org/settings/integrations',
  useSearchParams: () => params.current,
}));

const off = { provider: 'apollo', connected: false, account: null, connected_at: null };
const on = { provider: 'apollo', connected: true, account: 'sales@acme.test', connected_at: '2026-11-26T10:00:00.000Z' };

function serve(status: unknown, admin = true) {
  api.mockImplementation(async (path, init) => {
    if (path === '/api/v1/me') return { can_manage_objects: admin, can_manage_integrations: admin, can_enrich_records: true };
    if (init?.method === 'PUT') return on;
    if (init?.method === 'DELETE') return { provider: 'apollo', connected: false };
    return status;
  });
}

beforeEach(() => {
  api.mockReset();
  replace.mockReset();
  params.current = new URLSearchParams();
});

describe('IntegrationsSheet', () => {
  it('lists Apollo with its status, and opens it in the URL when clicked', async () => {
    serve(on);
    render(<IntegrationsSheet />);
    expect(await screen.findByText('Connected')).toBeTruthy();
    expect(screen.getByText('sales@acme.test')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Open Apollo' }));
    expect(replace).toHaveBeenCalledWith('/org/settings/integrations?open=apollo', { scroll: false });
  });

  it('shows the connection drawer when the URL says so, and lets an admin connect', async () => {
    params.current = new URLSearchParams('open=apollo');
    serve(off);
    render(<IntegrationsSheet />);

    fireEvent.change(await screen.findByLabelText('Apollo API key'), { target: { value: 'abcdefgh1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        '/api/v1/integrations/apollo',
        expect.objectContaining({ method: 'PUT', json: { api_key: 'abcdefgh1234' } }),
      ),
    );
    expect((await screen.findAllByText(/sales@acme.test/)).length).toBeGreaterThan(0);
    expect((screen.getByLabelText('Replace the API key') as HTMLInputElement).value).toBe('');
  });

  it('shows the server reason when Apollo refuses the key', async () => {
    params.current = new URLSearchParams('open=apollo');
    api.mockImplementation(async (path, init) => {
      if (init?.method === 'PUT') throw new Error('Apollo did not accept that API key.');
      return path === '/api/v1/me' ? { can_manage_integrations: true } : off;
    });
    render(<IntegrationsSheet />);
    fireEvent.change(await screen.findByLabelText('Apollo API key'), { target: { value: 'wrongwrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByText('Apollo did not accept that API key.')).toBeTruthy();
  });

  it('asks before disconnecting', async () => {
    params.current = new URLSearchParams('open=apollo');
    serve(on);
    render(<IntegrationsSheet />);
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    expect(screen.getByText(/Enrichment stops working/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, disconnect' }));
    await waitFor(() => expect(screen.getAllByText('Not connected').length).toBeGreaterThan(0));
  });

  it('shows a member the status without a key form', async () => {
    params.current = new URLSearchParams('open=apollo');
    serve(on, false);
    render(<IntegrationsSheet />);
    expect(await screen.findByText('An owner or admin manages this connection.')).toBeTruthy();
    expect(screen.queryByLabelText('Replace the API key')).toBeNull();
  });
});

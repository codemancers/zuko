import { fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/render';
import { ApiError } from '@/lib/api';
import { AccessSheet } from './access-sheet';

const api = vi.hoisted(() =>
  vi.fn<(path: string, init?: { method?: string; json?: unknown }) => Promise<unknown>>(),
);
vi.mock('@/lib/api', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api')>('@/lib/api')),
  api,
}));

type Override = { role: string; object: string | null; read_scope: string; write_scope: string };
type Call = { path: string; init?: { method?: string; json?: unknown } };

function fakeBackend(options: { overrides?: Override[]; denied?: boolean; refuse?: string } = {}) {
  const state = { overrides: [...(options.overrides ?? [])], calls: [] as Call[] };
  api.mockImplementation(async (path, init) => {
    state.calls.push({ path, init });
    const method = init?.method ?? 'GET';
    if (path === '/api/v1/access/roles' && method === 'GET') {
      if (options.denied)
        throw new ApiError('You are not allowed to view access settings', 403, 'FORBIDDEN');
      return {
        defaults: {
          owner: { read_scope: 'ALL', write_scope: 'ALL' },
          admin: { read_scope: 'ALL', write_scope: 'ALL' },
          member: { read_scope: 'OWN_AND_REPORTS', write_scope: 'OWN' },
        },
        overrides: state.overrides.map((o) => ({ ...o })),
      };
    }
    if (path === '/api/v1/objects')
      return {
        results: [
          { name: 'contact', plural_label: 'Contacts' },
          { name: 'deal', plural_label: 'Deals' },
        ],
      };
    const role = path.match(/^\/api\/v1\/access\/roles\/(\w+)/);
    if (role && method === 'PUT') {
      if (options.refuse) throw new ApiError(options.refuse, 400, 'ROLE_FIXED');
      const body = init?.json as { object: string | null; read_scope: string; write_scope: string };
      state.overrides = state.overrides.filter(
        (o) => !(o.role === role[1] && o.object === body.object),
      );
      state.overrides.push({ role: role[1], ...body });
      return body;
    }
    if (role && method === 'DELETE') {
      const object = new URL(path, 'http://x').searchParams.get('object');
      state.overrides = state.overrides.filter((o) => !(o.role === role[1] && o.object === object));
      return { removed: 1 };
    }
    throw new Error(`unexpected call ${method} ${path}`);
  });
  return state;
}

const picked = (name: string) => {
  const select = screen.getByLabelText(name) as HTMLSelectElement;
  return select.options[select.selectedIndex].text;
};

beforeEach(() => {
  api.mockReset();
});

describe('AccessSheet', () => {
  it('shows what members get, for all objects and for each object, and leaves owners and admins out', async () => {
    fakeBackend();
    render(<AccessSheet />);
    await screen.findByLabelText('Member can see All objects');

    expect(picked('Member can see All objects')).toBe('Their own and their reports’');
    expect(picked('Member can change All objects')).toBe('Their own');
    expect(picked('Member can see Deals')).toBe('Their own and their reports’'); // inherited
    expect(screen.queryByLabelText(/Owner can/)).toBeNull();
    expect(screen.queryByLabelText(/Admin can/)).toBeNull();
    expect(screen.getByText(/Owners and admins always have access to everything/)).toBeTruthy();
    expect(screen.getAllByText('Inherited')).toHaveLength(2);
  });

  it('changes a setting for all objects, and the objects without their own setting follow', async () => {
    const backend = fakeBackend();
    render(<AccessSheet />);
    fireEvent.change(await screen.findByLabelText('Member can change All objects'), {
      target: { value: 'ALL' },
    });

    await waitFor(() =>
      expect(backend.calls.find((c) => c.init?.method === 'PUT')?.init?.json).toEqual({
        object: null,
        read_scope: 'OWN_AND_REPORTS',
        write_scope: 'ALL',
      }),
    );
    await waitFor(() => expect(picked('Member can change Deals')).toBe('Everything'));
    expect(screen.getByText('Custom')).toBeTruthy();
  });

  it('gives one object its own setting, and resets it', async () => {
    const backend = fakeBackend();
    render(<AccessSheet />);
    fireEvent.change(await screen.findByLabelText('Member can see Deals'), {
      target: { value: 'OWN' },
    });

    await waitFor(() =>
      expect(backend.calls.find((c) => c.init?.method === 'PUT')?.init?.json).toEqual({
        object: 'deal',
        read_scope: 'OWN',
        write_scope: 'OWN',
      }),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reset Deals' })).toBeTruthy());
    expect(picked('Member can see Contacts')).toBe('Their own and their reports’'); // the others are untouched

    fireEvent.click(screen.getByRole('button', { name: 'Reset Deals' }));
    await waitFor(() =>
      expect(backend.calls.find((c) => c.init?.method === 'DELETE')?.path).toBe(
        '/api/v1/access/roles/member?object=deal',
      ),
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reset Deals' })).toBeNull());
    expect(picked('Member can see Deals')).toBe('Their own and their reports’');
  });

  it('keeps the setting on the other side when one is changed', async () => {
    const backend = fakeBackend({
      overrides: [{ role: 'member', object: 'deal', read_scope: 'TEAM', write_scope: 'TEAM' }],
    });
    render(<AccessSheet />);
    fireEvent.change(await screen.findByLabelText('Member can change Deals'), {
      target: { value: 'OWN' },
    });
    await waitFor(() =>
      expect(backend.calls.find((c) => c.init?.method === 'PUT')?.init?.json).toEqual({
        object: 'deal',
        read_scope: 'TEAM',
        write_scope: 'OWN',
      }),
    );
  });

  it('says why a change was refused', async () => {
    fakeBackend({ refuse: 'The owner role always has access to every record' });
    render(<AccessSheet />);
    fireEvent.change(await screen.findByLabelText('Member can see All objects'), {
      target: { value: 'OWN' },
    });
    expect(
      (await screen.findAllByText(/always has access to every record/)).length,
    ).toBeGreaterThan(0);
  });

  it('tells a member that this is for owners and admins', async () => {
    fakeBackend({ denied: true });
    render(<AccessSheet />);
    expect(await screen.findByText('Only owners and admins can see access settings.')).toBeTruthy();
  });
});

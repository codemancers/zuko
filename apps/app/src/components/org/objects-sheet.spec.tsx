import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { render } from '@/test/render';
import { ApiError } from '@/lib/api';
import { OBJECTS_CHANGED } from '@/lib/objects-events';
import { navigation } from '@/test/navigation-mock';
import { ObjectsSheet } from './objects-sheet';

const api = vi.hoisted(() =>
  vi.fn<(path: string, init?: { method?: string; json?: unknown }) => Promise<unknown>>(),
);
vi.mock('next/navigation', async () => (await import('@/test/navigation-mock')).navigationModule);
vi.mock('@/lib/api', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api')>('@/lib/api')),
  api,
}));

type Call = { path: string; init?: { method?: string; json?: unknown } };

const contact = {
  id: '1',
  name: 'contact',
  label: 'Contact',
  plural_label: 'Contacts',
  object_kind: 'STANDARD',
  field_count: 6,
};
const company = {
  id: '2',
  name: 'company',
  label: 'Company',
  plural_label: 'Companies',
  object_kind: 'STANDARD',
  field_count: 6,
};
const project = {
  id: '3',
  name: 'project',
  label: 'Project',
  plural_label: 'Projects',
  object_kind: 'CUSTOM',
  field_count: 1,
};
const link = {
  id: '1',
  name: 'contact_company',
  label: 'Contact and company',
  source: { name: 'contact', label: 'Contact' },
  target: { name: 'company', label: 'Company' },
};

function fakeBackend(options: { admin?: boolean; failCreate?: string; failField?: boolean } = {}) {
  const state = { objects: [contact, company, project], links: [link], calls: [] as Call[] };
  api.mockImplementation(async (path: string, init?: Call['init']) => {
    state.calls.push({ path, init });
    const method = init?.method ?? 'GET';
    if (path === '/api/v1/objects' && method === 'GET')
      return { results: state.objects.map((o) => ({ ...o })) };
    if (path === '/api/v1/associations' && method === 'GET')
      return { results: state.links.map((l) => ({ ...l })) };
    if (path === '/api/v1/me') return { can_manage_objects: options.admin === true };
    if (path === '/api/v1/objects' && method === 'POST') {
      if (options.failCreate) throw new ApiError(options.failCreate, 409, 'CONFLICT');
      const made = init?.json as { slug: string; label: string; plural_label?: string };
      state.objects.push({
        id: '9',
        name: made.slug,
        label: made.label,
        plural_label: made.plural_label ?? `${made.label}s`,
        object_kind: 'CUSTOM',
        field_count: 0,
      });
      return made;
    }
    if (/^\/api\/v1\/objects\/\w+\/fields$/.test(path) && method === 'POST') {
      if (options.failField) throw new ApiError('nope', 500);
      state.objects[state.objects.length - 1].field_count = 1;
      return {};
    }
    throw new Error(`unexpected call ${method} ${path}`);
  });
  return state;
}

beforeEach(() => {
  api.mockReset();
  navigation.reset();
});

describe('ObjectsSheet', () => {
  it('lists every object with its kind, fields and what it is linked to', async () => {
    fakeBackend();
    render(<ObjectsSheet />);
    expect(await screen.findByRole('link', { name: 'Projects' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Contacts' }).getAttribute('href')).toBe(
      '/records/contact',
    );
    const rows = screen.getAllByRole('row');
    const text = (needle: string) =>
      rows.find((r) => r.textContent?.includes(needle))?.textContent ?? '';
    expect(text('Contacts')).toMatch(/Standard.*6.*Company/);
    expect(text('Companies')).toMatch(/Contact/);
    expect(text('Projects')).toMatch(/Custom/);
  });

  it('offers creating and linking only to those who can manage objects', async () => {
    fakeBackend();
    render(<ObjectsSheet />);
    await screen.findByRole('link', { name: 'Projects' });
    expect(screen.queryByRole('button', { name: /New object/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add object' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Link objects/ })).toBeNull();
  });

  it('creates an object with a Name field, derives the key from the name, and tells the sidebar', async () => {
    const backend = fakeBackend({ admin: true });
    const changed = vi.fn<() => void>();
    window.addEventListener(OBJECTS_CHANGED, changed);
    render(<ObjectsSheet />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add object' }));
    expect(navigation.params.get('new_object')).toBe('1');

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Name \(singular\)/), {
      target: { value: 'Support ticket' },
    });
    expect((within(dialog).getByLabelText(/Key/) as HTMLInputElement).value).toBe('support_ticket');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create object' }));

    expect(await screen.findByRole('link', { name: 'Support tickets' })).toBeTruthy();
    const posts = backend.calls
      .filter((c) => c.init?.method === 'POST')
      .map((c) => [c.path, c.init?.json]);
    expect(posts[0]).toEqual([
      '/api/v1/objects',
      { slug: 'support_ticket', label: 'Support ticket' },
    ]);
    expect(posts[1][0]).toBe('/api/v1/objects/support_ticket/fields');
    expect(posts[1][1]).toMatchObject({ name: 'name', type: 'TEXT', required: true });
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(navigation.params.has('new_object')).toBe(false);
    window.removeEventListener(OBJECTS_CHANGED, changed);
  });

  it('shows why an object could not be created, and keeps the form', async () => {
    fakeBackend({ admin: true, failCreate: 'Object type already exists' });
    render(<ObjectsSheet />);
    fireEvent.click(await screen.findByRole('button', { name: /New object/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Name \(singular\)/), {
      target: { value: 'Project' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create object' }));
    expect(await within(dialog).findByText('Object type already exists')).toBeTruthy();
    expect((within(dialog).getByLabelText(/Name \(singular\)/) as HTMLInputElement).value).toBe(
      'Project',
    );
  });

  it("has no way to link objects here: links are fields, added on the object's own page", async () => {
    fakeBackend({ admin: true });
    render(<ObjectsSheet />);
    await screen.findByRole('button', { name: /New object/ });
    expect(screen.queryByRole('button', { name: /Link objects/ })).toBeNull();
    expect(screen.getByText(/links to other objects are added there, as fields/)).toBeTruthy();
  });

  it('lists a kind once however many links reach it', async () => {
    const backend = fakeBackend();
    backend.links.push({
      ...link,
      id: '2',
      name: 'deal_primary_contact',
      source: { name: 'deal', label: 'Deal' },
      target: { name: 'contact', label: 'Contact' },
    });
    backend.links.push({
      ...link,
      id: '3',
      name: 'deal_secondary_contact',
      source: { name: 'deal', label: 'Deal' },
      target: { name: 'contact', label: 'Contact' },
    });
    backend.objects.push({
      id: '4',
      name: 'deal',
      label: 'Deal',
      plural_label: 'Deals',
      object_kind: 'STANDARD',
      field_count: 3,
    });
    render(<ObjectsSheet />);
    await screen.findByRole('link', { name: 'Deals' });
    const deals =
      screen.getAllByRole('row').find((r) => r.textContent?.includes('Deals'))?.textContent ?? '';
    expect(deals.match(/Contact/g)).toHaveLength(1);
  });

  it('says so when the objects cannot be loaded', async () => {
    api.mockRejectedValue(new ApiError('The server is unavailable', 500));
    render(<ObjectsSheet />);
    expect(await screen.findByText('The server is unavailable')).toBeTruthy();
  });
});

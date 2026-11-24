import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { render } from '@/test/render';
import { CommandMenu, CommandMenuTrigger } from './command-menu';

type Init = { method?: string; signal?: AbortSignal; json?: unknown };
const api = vi.hoisted(() => vi.fn<(path: string, init?: Init) => Promise<unknown>>());
const router = vi.hoisted(() => ({ push: vi.fn<(path: string) => void>() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/api', () => ({ api }));
const contact = {
  name: 'contact',
  label: 'Contact',
  plural_label: 'Contacts',
  fields: [
    { name: 'first_name', type: 'TEXT', filterable: true },
    { name: 'last_name', type: 'TEXT', filterable: true },
    { name: 'email', type: 'EMAIL', filterable: true },
  ],
};
const ada = {
  id: '1',
  properties: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' },
};
const grace = { id: '2', properties: { first_name: 'Grace', last_name: 'Hopper' } };
const page = (
  results: { id: string; properties: Record<string, unknown> }[] = [ada],
  hasNext = false,
) => ({ results, metadata: { has_next: hasNext } });
function setup() {
  return render(
    <CommandMenu>
      <CommandMenuTrigger />
      <button>Editor</button>
    </CommandMenu>,
  );
}
async function open() {
  fireEvent.click(screen.getByRole('button', { name: 'Open command menu' }));
  return screen.findByRole('combobox', { name: 'Search commands and records' });
}
const type = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });
beforeEach(() => {
  api.mockReset();
  router.push.mockReset();
  api.mockImplementation(async (path) => {
    if (path === '/api/v1/objects') return { results: [contact] };
    if (path === '/api/v1/objects/contact') return contact;
    if (path.endsWith('/records/filter')) return page();
    throw new Error(`Unexpected request: ${path}`);
  });
});

describe('workspace command menu', () => {
  it.each([{ metaKey: true }, { ctrlKey: true }])(
    'opens with Cmd/Ctrl+K and returns focus after Escape (%j)',
    async (modifier) => {
      setup();
      const editor = screen.getByRole('button', { name: 'Editor' });
      editor.focus();
      expect(api).not.toHaveBeenCalled();
      fireEvent.keyDown(document, { key: 'k', ...modifier });
      const dialog = await screen.findByRole('dialog', { name: 'Command menu' });
      await waitFor(() =>
        expect(document.activeElement).toBe(within(dialog).getByRole('combobox')),
      );
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(document.activeElement).toBe(editor);
    },
  );

  it('toggles closed on Ctrl+K even while typing in the menu', async () => {
    setup();
    const input = await open();
    fireEvent.keyDown(input, { key: 'k', ctrlKey: true });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('does not intercept plain K, repeated, or composing shortcuts', () => {
    setup();
    fireEvent.keyDown(document, { key: 'k' });
    fireEvent.keyDown(document, { key: 'k', metaKey: true, repeat: true });
    fireEvent.keyDown(document, { key: 'k', metaKey: true, isComposing: true });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    ['Home', '/dashboard'],
    ['Contacts', '/records/contact'],
    ['Companies', '/records/company'],
    ['Deals', '/records/deal'],
    ['Profile', '/account/profile'],
    ['Connected apps', '/account/connections'],
    ['Organization settings', '/org/settings/details'],
    ['members', '/org/settings/members'],
    ['Objects', '/org/settings/objects'],
    ['permissions', '/org/settings/access'],
    ['Create organization', '/organizations/new'],
  ])('opens the correct page for %s using Enter', async (query, target) => {
    setup();
    const input = await open();
    type(input, query);
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(target));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers custom objects and creates through the existing record flow', async () => {
    api.mockResolvedValue({
      results: [contact, { name: 'project', label: 'Project', plural_label: 'Projects' }],
    });
    setup();
    const input = await open();
    type(input, 'Create project');
    fireEvent.click(await screen.findByRole('option', { name: 'Create project' }));
    expect(router.push).toHaveBeenCalledWith('/records/project?new=1');
  });

  it('searches the server after a pause and opens the chosen record', async () => {
    setup();
    const input = await open();
    type(input, 'Ada');
    expect(api.mock.calls.some(([path]) => path.endsWith('/records/filter'))).toBe(false);
    fireEvent.click(await screen.findByRole('option', { name: /Ada Lovelace/ }));
    expect(router.push).toHaveBeenCalledWith('/records/contact?open=1');
    expect(api).toHaveBeenCalledWith(
      '/api/v1/objects/contact/records/filter',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
        json: expect.objectContaining({
          pagination: { page: 1, page_size: 5 },
          filter_groups: expect.arrayContaining([
            { filters: [{ field_path: 'email', operator: 'CONTAINS', value: 'Ada' }] },
          ]),
        }),
      }),
    );
  });

  it('selects a record match without unrelated weak command matches', async () => {
    setup();
    type(await open(), 'Ada');
    const result = await screen.findByRole('option', { name: /Ada Lovelace/ });
    await waitFor(() => expect(result.getAttribute('aria-selected')).toBe('true'));
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('does not hide server matches found by email rather than by label', async () => {
    setup();
    type(await open(), 'ada@example.com');
    expect(await screen.findByRole('option', { name: /Ada Lovelace/ })).toBeTruthy();
  });

  it('hides stale matches immediately and ignores a superseded response', async () => {
    let finish!: (value: unknown) => void;
    api.mockImplementation(async (path, init) => {
      if (path === '/api/v1/objects') return { results: [contact] };
      if (path === '/api/v1/objects/contact') return contact;
      const json = init?.json as { filter_groups: { filters: { value: string }[] }[] };
      if (json.filter_groups[0].filters[0].value === 'Ada')
        return new Promise((resolve) => {
          finish = resolve;
        });
      return page([grace]);
    });
    setup();
    const input = await open();
    type(input, 'Ada');
    await waitFor(() => expect(finish).toBeDefined());
    type(input, 'Grace');
    expect(screen.queryByRole('option', { name: /Ada Lovelace/ })).toBeNull();
    await screen.findByRole('option', { name: /Grace Hopper/ });
    await act(async () => finish(page()));
    expect(screen.queryByRole('option', { name: /Ada Lovelace/ })).toBeNull();
  });

  it('fetches current records when a previous lookup is reopened', async () => {
    let surname = 'Lovelace';
    api.mockImplementation(async (path) => {
      if (path === '/api/v1/objects') return { results: [contact] };
      if (path === '/api/v1/objects/contact') return contact;
      return page([{ ...ada, properties: { ...ada.properties, last_name: surname } }]);
    });
    setup();
    type(await open(), 'Ada');
    await screen.findByRole('option', { name: /Ada Lovelace/ });
    fireEvent.click(screen.getByRole('button', { name: 'Close command menu' }));
    surname = 'Byron';
    type(await open(), 'Ada');
    expect(await screen.findByRole('option', { name: /Ada Byron/ })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Ada Lovelace/ })).toBeNull();
  });

  it('shows a per-object failure and retries without losing the query', async () => {
    api.mockImplementation(async (path) => {
      if (path === '/api/v1/objects') return { results: [contact] };
      if (path === '/api/v1/objects/contact') return contact;
      throw new Error('Search temporarily unavailable');
    });
    setup();
    const input = await open();
    type(input, 'Ada');
    expect(await screen.findByText(/Search temporarily unavailable/)).toBeTruthy();
    api.mockResolvedValue(page());
    fireEvent.click(screen.getByRole('button', { name: 'Retry contacts' }));
    expect(await screen.findByRole('option', { name: /Ada Lovelace/ })).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe('Ada');
  });

  it('offers the full matching sheet when there are more than five results', async () => {
    api.mockImplementation(async (path) =>
      path === '/api/v1/objects'
        ? { results: [contact] }
        : path === '/api/v1/objects/contact'
          ? contact
          : page([ada], true),
    );
    setup();
    type(await open(), 'Ada');
    fireEvent.click(await screen.findByRole('option', { name: 'View all matching contacts' }));
    expect(router.push).toHaveBeenCalledWith('/records/contact?q=Ada');
  });

  it('shows the empty state only after the search completes', async () => {
    api.mockImplementation(async (path) =>
      path === '/api/v1/objects'
        ? { results: [contact] }
        : path === '/api/v1/objects/contact'
          ? contact
          : page([]),
    );
    setup();
    type(await open(), 'Nobody');
    expect(screen.queryByText('No matching commands or records.')).toBeNull();
    expect(await screen.findByText('No matching commands or records.')).toBeTruthy();
  });
});

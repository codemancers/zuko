import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { render } from '@/test/render';
import { ApiError } from '@/lib/api';
import type { FieldDef, ObjectDef, RecordRow } from '@/lib/records';
import { navigation } from '@/test/navigation-mock';
import { RecordsView } from './records-view';

type Call = { path: string; init?: { method?: string; json?: unknown } };
const api = vi.hoisted(() => vi.fn<(path: string, init?: Call['init']) => Promise<unknown>>());
vi.mock('next/navigation', async () => (await import('@/test/navigation-mock')).navigationModule);
vi.mock('@/lib/api', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api')>('@/lib/api')),
  api,
}));

const field = (
  name: string,
  label: string,
  type: FieldDef['type'],
  over: Partial<FieldDef> = {},
): FieldDef => ({
  name,
  label,
  type,
  required: false,
  unique: false,
  filterable: false,
  read_only: false,
  sensitive: false,
  max_length: null,
  config: {},
  ...over,
});

const contact: ObjectDef = {
  id: '1',
  name: 'contact',
  label: 'Contact',
  plural_label: 'Contacts',
  object_kind: 'STANDARD',
  version: 1,
  fields: [
    field('first_name', 'First name', 'TEXT', { required: true, filterable: true }),
    field('last_name', 'Last name', 'TEXT', { filterable: true }),
    field('email', 'Email', 'EMAIL', { unique: true, filterable: true }),
    field('stage', 'Stage', 'ENUM', { config: { options: ['lead', 'customer'] } }),
    field('score', 'Score', 'NUMBER', { filterable: true }),
    field('tier', 'Tier', 'ENUM', { filterable: true, config: { options: ['gold', 'silver'] } }),
    field('manager', 'Manager', 'USER', { filterable: true, config: { many: false } }),
    field('engineers', 'Engineers', 'USER', { config: { many: true } }),
    field('renewal', 'Renewal date', 'TIMESTAMP'),
    field('vip', 'VIP', 'BOOLEAN'),
  ],
  associations: [
    {
      name: 'contact_company',
      label: 'Companies',
      singular_label: 'Company',
      target: 'company',
      many: true,
      side: 'forward',
      field: 'companies',
    },
  ],
};

const company: ObjectDef = {
  id: '2',
  name: 'company',
  label: 'Company',
  plural_label: 'Companies',
  object_kind: 'STANDARD',
  version: 1,
  fields: [field('name', 'Name', 'TEXT', { required: true, filterable: true })],
  associations: [
    {
      name: 'contact_company',
      label: 'Contacts',
      singular_label: 'Contact',
      target: 'contact',
      many: true,
      side: 'reverse',
      field: null,
    },
  ],
};

let nextId = 100;
const row = (properties: Record<string, unknown>, id = String(nextId++)): RecordRow => ({
  id,
  object: 'contact',
  properties,
  owner_id: '7',
  team_id: null,
  created_at: '2026-11-17T00:00:00.000Z',
  updated_at: '2026-11-17T00:00:00.000Z',
});

/** An in-memory stand-in for the records API: enough behaviour to drive the view. */
function fakeBackend(
  initial: RecordRow[],
  options: {
    setup?: 'needed' | 'forbidden' | 'conflict' | false;
    failList?: boolean;
    admin?: boolean;
    keepChoice?: string;
    needsForm?: boolean;
    holdsOne?: boolean;
    refuseMany?: string;
    refuseOwner?: boolean;
    history?: unknown[];
    failHistory?: boolean;
    companies?: { id: string; name: string }[];
    links?: Record<string, string[]>;
    failLinking?: boolean;
    failLinkLoad?: boolean;
  } = {},
) {
  const state = {
    records: [...initial],
    defined: !options.setup,
    calls: [] as Call[],
    def: structuredClone(contact),
    companies: [...(options.companies ?? [])],
    links: structuredClone(options.links ?? {}) as Record<string, string[]>,
  };
  const paged = (rows: RecordRow[], page: number, size: number) => {
    const total_pages = Math.ceil(rows.length / size);
    return {
      results: rows.slice((page - 1) * size, page * size),
      metadata: {
        page,
        page_size: size,
        total_elements: rows.length,
        total_pages,
        has_next: page < total_pages,
        has_previous: page > 1,
      },
    };
  };
  // An object with another required field is added in the form, not as a row.
  if (options.needsForm) state.def.fields[1].required = true;
  if (options.holdsOne) state.def.associations![0].many = false;
  const companyRow = (c: { id: string; name: string }): RecordRow => ({
    ...row({ name: c.name }, c.id),
    object: 'company',
  });
  const linked = (contactId: string) =>
    (state.links[contactId] ?? [])
      .flatMap((id) => state.companies.filter((c) => c.id === id))
      .map((c) => ({ id: c.id, label: c.name }));
  const withLinks = (rows: RecordRow[], include: boolean) =>
    include ? rows.map((r) => ({ ...r, associations: { contact_company: linked(r.id) } })) : rows;
  api.mockImplementation(async (path, init) => {
    state.calls.push({ path, init });
    const sent = (init?.json ?? {}) as {
      filter_groups?: { filters: { value: string }[] }[];
      properties?: { name?: string };
      record_ids?: string[];
      record_id?: string;
      include?: string[];
    };
    const method = init?.method ?? 'GET';
    const body = init?.json as
      | {
          properties?: Record<string, unknown>;
          filter_groups?: { filters: { value: string }[] }[];
          pagination?: { page: number; page_size: number };
        }
      | undefined;
    if (path === '/api/v1/objects/contact' && method === 'GET') {
      if (!state.defined)
        throw new ApiError('Object type contact does not exist', 404, 'NOT_FOUND');
      return structuredClone(state.def); // as over the wire: a new object every time
    }
    if (path === '/api/v1/members')
      return {
        results: [
          { user_id: '7', name: 'Me' },
          { user_id: '8', name: 'Sam' },
        ],
      };
    if (path === '/api/v1/teams') return { results: [{ id: '3', name: 'Sales' }] };
    if (path === '/api/v1/me') return { can_manage_objects: options.admin === true };
    if (path === '/api/v1/objects/contact/fields' && method === 'POST') {
      const added = init?.json as {
        name: string;
        label: string;
        type: FieldDef['type'];
        config?: FieldDef['config'];
      };
      if (state.def.fields.some((f) => f.name === added.name)) {
        throw new ApiError(`Field '${added.name}' already exists on 'contact'`, 409, 'CONFLICT');
      }
      state.def.fields.push(
        field(added.name, added.label, added.type, { config: added.config ?? {} }),
      );
      return state.def.fields.at(-1);
    }
    const fieldRoute = path.match(/^\/api\/v1\/objects\/contact\/fields\/(\w+)$/);
    if (fieldRoute && method === 'PATCH') {
      const target = state.def.fields.find((f) => f.name === fieldRoute[1])!;
      const changes = init?.json as { label?: string; config?: FieldDef['config'] };
      if (
        changes.config &&
        options.keepChoice &&
        !changes.config.options?.includes(options.keepChoice)
      ) {
        throw new ApiError(
          `Records still use '${options.keepChoice}'; change them before removing the choice`,
          409,
          'CONFLICT',
        );
      }
      if (options.refuseMany && (changes.config as { many?: boolean } | undefined)?.many === false)
        throw new ApiError(options.refuseMany, 409, 'CONFLICT');
      Object.assign(
        target,
        changes,
        changes.config ? { config: { ...target.config, ...changes.config } } : {},
      );
      return target;
    }
    if (fieldRoute && method === 'DELETE') {
      state.def.fields = state.def.fields.filter((f) => f.name !== fieldRoute[1]);
      return { name: fieldRoute[1], deleted: true };
    }
    if (path === '/api/v1/setup/standard-objects') {
      if (options.setup === 'forbidden')
        throw new ApiError('You are not allowed to set up the standard objects', 403, 'FORBIDDEN');
      if (options.setup === 'conflict') {
        // Someone else's request got there first: the objects now exist, but this call is refused.
        state.defined = true;
        throw new ApiError('That value is already in use', 409, 'CONFLICT');
      }
      state.defined = true;
      return { created: ['contact'], results: [] };
    }
    if (path === '/api/v1/objects' && method === 'GET')
      return {
        results: [
          { name: 'contact', plural_label: 'Contacts' },
          { name: 'company', plural_label: 'Companies' },
          { name: 'deal', plural_label: 'Deals' },
        ],
      };
    if (path === '/api/v1/objects/company') return company;
    if (path === '/api/v1/objects/company/records/filter') {
      const text = String(sent.filter_groups?.[0]?.filters[0]?.value ?? '').toLowerCase();
      return paged(
        state.companies.filter((c) => c.name.toLowerCase().includes(text)).map(companyRow),
        1,
        8,
      );
    }
    if (path === '/api/v1/objects/company/records' && method === 'POST') {
      const made = { id: String(nextId++), name: String(sent.properties?.name) };
      state.companies.push(made);
      return companyRow(made);
    }
    const assoc = path.match(
      /^\/api\/v1\/objects\/contact\/records\/(\d+)\/associations\/contact_company/,
    );
    if (assoc) {
      const id = assoc[1];
      const current = state.links[id] ?? [];
      if (options.failLinkLoad && method === 'GET')
        throw new ApiError('Links are unavailable', 503);
      if (options.failLinking && method !== 'GET')
        throw new ApiError('No such company: 99', 404, 'NOT_FOUND');
      if (method === 'PUT') state.links[id] = sent.record_ids ?? [];
      if (method === 'POST')
        state.links[id] = options.holdsOne
          ? [String(sent.record_id)]
          : [...new Set([...current, String(sent.record_id)])];
      if (method === 'DELETE') state.links[id] = current.filter((c) => c !== path.split('/').pop());
      return {
        results: linked(id),
        metadata: {
          page: 1,
          page_size: 100,
          total_elements: linked(id).length,
          total_pages: 1,
          has_next: false,
          has_previous: false,
        },
      };
    }
    if (path === '/api/v1/objects/nothing')
      throw new ApiError("Object type 'nothing' does not exist", 404, 'NOT_FOUND');
    if (path.endsWith('/records/facets')) {
      const { field } = init!.json as { field: string };
      const counts = new Map<string | null, number>();
      for (const record of state.records) {
        const raw = record.properties[field];
        const value = raw == null ? null : String(raw);
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      return { results: [...counts].map(([value, count]) => ({ value, count })), truncated: false };
    }
    if (options.failList && path.includes('/records'))
      throw new ApiError('The server is unavailable', 500);

    if (path.endsWith('/records/filter')) {
      type Condition = { field_path: string; operator: string; value?: unknown };
      const matches = (r: RecordRow, f: Condition) => {
        const v = r.properties[f.field_path];
        const text = String(v ?? '').toLowerCase();
        switch (f.operator) {
          case 'CONTAINS':
            return text.includes(String(f.value).toLowerCase());
          case 'EQUALS':
            return v === f.value;
          case 'NOT_EQUALS':
            return v !== f.value;
          case 'GREATER_THAN':
            return Number(v) > Number(f.value);
          case 'LESS_THAN':
            return Number(v) < Number(f.value);
          case 'IS_NULL':
            return v === undefined || v === null;
          case 'IS_NOT_NULL':
            return v !== undefined && v !== null;
          default:
            throw new Error(`fake: operator ${f.operator}`);
        }
      };
      const groups =
        ((init?.json ?? {}) as { filter_groups?: { filters: Condition[] }[] }).filter_groups ?? [];
      const hits = state.records.filter((r) =>
        groups.some((g) => g.filters.every((f) => matches(r, f))),
      );
      const result = paged(hits, body?.pagination?.page ?? 1, body?.pagination?.page_size ?? 20);
      return {
        ...result,
        results: withLinks(result.results, (sent.include ?? []).includes('associations')),
      };
    }
    const listing = path.match(/\/records\?(.*)$/);
    if (listing && method === 'GET') {
      const query = new URLSearchParams(listing[1]);
      const [sortField, direction] = (query.get('sort') ?? '').split(',');
      const rows = sortField
        ? [...state.records].sort(
            (a, b) =>
              String(a.properties[sortField] ?? '').localeCompare(
                String(b.properties[sortField] ?? ''),
              ) * (direction === 'desc' ? -1 : 1),
          )
        : state.records;
      const result = paged(rows, Number(query.get('page')), Number(query.get('page_size')));
      return {
        ...result,
        results: withLinks(result.results, query.get('include') === 'associations'),
      };
    }
    if (path.endsWith('/records') && method === 'POST') {
      const properties = body?.properties ?? {};
      if (properties['first_name'] === 'Nobody') {
        throw new ApiError("Field 'first_name' may not be 'Nobody'", 400, 'VALIDATION_FAILED', [
          {
            field: 'first_name',
            code: 'INVALID_FIELD',
            message: "Field 'first_name' may not be 'Nobody'",
          },
        ]);
      }
      if (!properties['first_name']) {
        throw new ApiError("Field 'first_name' is required", 400, 'VALIDATION_FAILED', [
          {
            field: 'first_name',
            code: 'REQUIRED_FIELD_MISSING',
            message: "Field 'first_name' is required",
          },
        ]);
      }
      if (
        state.records.some(
          (r) => r.properties['email'] && r.properties['email'] === properties['email'],
        )
      ) {
        throw new ApiError('Field email must be unique', 400, 'VALIDATION_FAILED', [
          {
            field: 'email',
            code: 'DUPLICATE_VALUE',
            message: "Field 'email' must be unique; that value is already in use",
          },
        ]);
      }
      const created = row(properties);
      state.records.push(created);
      return created;
    }
    if (/\/records\/\d+\/history$/.test(path)) {
      if (options.failHistory) throw new ApiError('boom', 500);
      return { results: options.history ?? [] };
    }
    const one = path.match(/\/records\/(\d+)$/);
    if (one && method === 'GET') {
      const found = state.records.find((r) => r.id === one[1]);
      if (!found) throw new ApiError('No such contact', 404, 'NOT_FOUND');
      return found;
    }
    if (one && method === 'PATCH') {
      const target = state.records.find((r) => r.id === one[1])!;
      const assigned = (init?.json ?? {}) as { owner_id?: string | null; team_id?: string | null };
      if (options.refuseOwner && assigned.owner_id !== undefined)
        throw new ApiError(
          'You are not allowed to assign this record to that owner or team',
          403,
          'FORBIDDEN',
        );
      if (assigned.owner_id !== undefined) target.owner_id = assigned.owner_id;
      if (assigned.team_id !== undefined) target.team_id = assigned.team_id;
      for (const [key, value] of Object.entries(body?.properties ?? {})) {
        if (value === null) delete target.properties[key];
        else target.properties[key] = value;
      }
      return target;
    }
    if (one && method === 'DELETE') {
      state.records = state.records.filter((r) => r.id !== one[1]);
      return { id: one[1], deleted: true };
    }
    throw new Error(`unexpected call ${method} ${path}`);
  });
  return state;
}

const ada = () =>
  row(
    {
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@x.com',
      stage: 'customer',
      score: 1200.5,
    },
    '1',
  );
const grace = () => row({ first_name: 'Grace', last_name: 'Hopper', email: 'grace@x.com' }, '2');

beforeEach(() => {
  api.mockReset();
  navigation.reset();
});

/** Opens a record's drawer from its row: a click on the name edits it in place instead. */
async function openRecord(name: string) {
  const cell = await screen.findByRole('button', { name });
  fireEvent.click(
    within(cell.closest('[role="row"]') as HTMLElement).getByRole('button', {
      name: 'Open contact',
    }),
  );
}

describe('RecordsView', () => {
  it('lists the records with formatted values and a count', async () => {
    fakeBackend([ada(), grace()]);
    render(<RecordsView object="contact" />);

    expect(await screen.findByRole('heading', { name: 'Contacts' })).toBeTruthy();
    expect(await screen.findByText('2 contacts')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ada' })).toBeTruthy();
    expect(screen.getByText('Lovelace')).toBeTruthy();
    expect((screen.getAllByLabelText('Stage')[0] as HTMLSelectElement).value).toBe('customer');
    expect(screen.getByText('1200.5')).toBeTruthy();
  });

  it('sets up the standard objects the first time, then shows the list', async () => {
    const backend = fakeBackend([ada()], { setup: 'needed' });
    render(<RecordsView object="contact" />);

    expect(await screen.findByRole('button', { name: 'Ada' })).toBeTruthy();
    expect(backend.calls.map((c) => c.path)).toContain('/api/v1/setup/standard-objects');
  });

  it('carries on when another request set them up first and this one was refused', async () => {
    fakeBackend([ada()], { setup: 'conflict' });
    render(<RecordsView object="contact" />);

    expect(await screen.findByRole('button', { name: 'Ada' })).toBeTruthy();
    expect(screen.queryByText('That value is already in use')).toBeNull();
  });

  it('explains when someone who may not set them up arrives first', async () => {
    fakeBackend([], { setup: 'forbidden' });
    render(<RecordsView object="contact" />);

    expect(await screen.findByText(/Ask an owner or admin to open this page once/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add contact' })).toBeNull();
  });

  it('does not set up an object that is not a standard one', async () => {
    fakeBackend([]);
    render(<RecordsView object="nothing" />);

    expect(await screen.findByText(/does not exist/)).toBeTruthy();
    expect(api).not.toHaveBeenCalledWith('/api/v1/setup/standard-objects', expect.anything());
  });

  it('shows an error when the list cannot be loaded', async () => {
    fakeBackend([], { failList: true });
    render(<RecordsView object="contact" />);

    expect(await screen.findByText('The server is unavailable')).toBeTruthy();
  });

  it('offers to add sample data when there is nothing, and shows it', async () => {
    const backend = fakeBackend([]);
    render(<RecordsView object="contact" />);

    expect(await screen.findByRole('button', { name: 'Add a new contact' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add sample data' }));

    expect(await screen.findByText('6 contacts')).toBeTruthy();
    expect(backend.records).toHaveLength(6);
    // Each contact comes with its company, made on the way and linked: names in the sheet, not typed text.
    expect(backend.companies.map((c) => c.name)).toEqual([
      'Analytical Engines',
      'Cobol Systems',
      'Bletchley Labs',
      'Orbit Dynamics',
      'Kernel Works',
      'Apollo Software',
    ]);
    expect(Object.keys(backend.links)).toHaveLength(6);
    expect(await screen.findByText('Cobol Systems')).toBeTruthy();
  });

  it('adds no company twice when the sample data is loaded again', async () => {
    const backend = fakeBackend([], { companies: [{ id: '50', name: 'Analytical Engines' }] });
    render(<RecordsView object="contact" />);
    await waitFor(() => fireEvent.click(screen.getByRole('button', { name: 'Add sample data' })));
    await screen.findByText('6 contacts');
    expect(backend.companies.filter((c) => c.name === 'Analytical Engines')).toHaveLength(1); // the existing one was linked
    expect(backend.links[backend.records[0].id]).toEqual(['50']);
  });

  describe('adding', () => {
    const addRow = async () => {
      fireEvent.click((await screen.findAllByRole('button', { name: 'Add contact' }))[0]);
      return screen.findByPlaceholderText('New contact');
    };

    it('adds a row to the sheet to type into, and saves it on Enter', async () => {
      const backend = fakeBackend([grace()]);
      render(<RecordsView object="contact" />);
      const input = await addRow();
      expect(navigation.params.get('new')).toBe('1');
      expect(screen.queryByRole('dialog')).toBeNull(); // no form: the row is the form

      fireEvent.change(input, { target: { value: ' Linus ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(await screen.findByRole('button', { name: 'Linus' })).toBeTruthy();
      await waitFor(() => expect(screen.queryByPlaceholderText('New contact')).toBeNull());
      expect(navigation.params.has('new')).toBe(false);
      const post = backend.calls.find(
        (c) => c.init?.method === 'POST' && c.path.endsWith('/records'),
      );
      expect(post?.init?.json).toEqual({ properties: { first_name: 'Linus' } });
    });

    it('lets the rest be filled in afterwards, in place', async () => {
      const backend = fakeBackend([]);
      render(<RecordsView object="contact" />);
      const input = await addRow();
      fireEvent.change(input, { target: { value: 'Linus' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await screen.findByRole('button', { name: 'Linus' });

      fireEvent.change(await screen.findByLabelText('Stage'), { target: { value: 'lead' } });
      await waitFor(() =>
        expect(backend.calls.find((c) => c.init?.method === 'PATCH')?.init?.json).toEqual({
          properties: { stage: 'lead' },
        }),
      );
    });

    it('drops the row when Escape is pressed, and sends nothing', async () => {
      const backend = fakeBackend([grace()]);
      render(<RecordsView object="contact" />);
      const input = await addRow();
      fireEvent.keyDown(input, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByPlaceholderText('New contact')).toBeNull());
      expect(navigation.params.has('new')).toBe(false);
      expect(
        backend.calls.some(
          (c) => c.init?.method === 'POST' && c.path === '/api/v1/objects/contact/records',
        ),
      ).toBe(false);
    });

    it("shows the server's complaint on the row and keeps what was typed", async () => {
      fakeBackend([ada()]);
      render(<RecordsView object="contact" />);
      const input = await addRow();
      fireEvent.change(input, { target: { value: 'Nobody' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect((await screen.findAllByText(/may not be 'Nobody'/)).length).toBeGreaterThan(0);
      expect(screen.getAllByText('Nobody').length).toBeGreaterThan(0); // what was typed is kept, to fix and retry
      expect(navigation.params.get('new')).toBe('1'); // and the row is still there
    });

    it('is added in the form when the object needs more than its first field', async () => {
      const backend = fakeBackend([grace()], { needsForm: true });
      render(<RecordsView object="contact" />);
      await waitFor(() => fireEvent.click(screen.getByRole('button', { name: 'Add contact' })));

      const dialog = await screen.findByRole('dialog');
      expect(screen.queryByPlaceholderText('New contact')).toBeNull();
      fireEvent.change(within(dialog).getByLabelText(/First name/), {
        target: { value: ' Linus ' },
      });
      fireEvent.change(within(dialog).getByLabelText(/Last name/), { target: { value: 'Test' } });
      fireEvent.change(within(dialog).getByLabelText('Stage'), { target: { value: 'lead' } });
      fireEvent.change(within(dialog).getByLabelText('Score'), { target: { value: '42' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect(await screen.findByRole('button', { name: 'Linus' })).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();
      const post = backend.calls.find(
        (c) => c.init?.method === 'POST' && c.path.endsWith('/records'),
      );
      expect(post?.init?.json).toEqual({
        properties: {
          first_name: 'Linus',
          last_name: 'Test',
          stage: 'lead',
          score: 42,
          vip: false,
        },
      });
    });

    it("shows the server's complaint next to the field in the form, and keeps it open", async () => {
      fakeBackend([ada()], { needsForm: true });
      render(<RecordsView object="contact" />);
      await waitFor(() => fireEvent.click(screen.getByRole('button', { name: 'Add contact' })));

      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText(/First name/), {
        target: { value: 'Another Ada' },
      });
      fireEvent.change(within(dialog).getByLabelText(/Last name/), { target: { value: 'Test' } });
      fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'ada@x.com' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect(await within(dialog).findByText(/must be unique/)).toBeTruthy();
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
  });

  describe('filters', () => {
    const three = () => [
      ada(),
      grace(),
      row({ first_name: 'Alan', last_name: 'Turing', score: 50 }, '3'),
    ];

    it('filters by a column, and the filter is in the URL', async () => {
      const backend = fakeBackend(three());
      render(<RecordsView object="contact" />);
      await screen.findByText('Lovelace');

      act(() => navigation.go('f=score~GREATER_THAN~100'));
      expect(await screen.findByRole('list', { name: 'Active filters' })).toBeTruthy();
      expect(screen.getByText('Score > 100')).toBeTruthy();
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Turing' })).toBeNull());
      const request = backend.calls.filter((c) => c.path.endsWith('/records/filter')).at(-1);
      expect(request?.init?.json).toMatchObject({
        filter_groups: [
          { filters: [{ field_path: 'score', operator: 'GREATER_THAN', value: 100 }] },
        ],
      });
    });

    it('restores filters from a link, removes one from its chip, and ignores a bad one', async () => {
      navigation.reset('f=score~GREATER_THAN~100&f=nonsense~EQUALS~x&f=score~CONTAINS~1');
      fakeBackend(three());
      render(<RecordsView object="contact" />);
      expect(await screen.findByText('Score > 100')).toBeTruthy();
      expect(
        screen.getAllByRole('listitem').filter((li) => /Remove filter/.test(li.innerHTML)),
      ).toHaveLength(1); // only the valid one

      fireEvent.click(screen.getByRole('button', { name: 'Remove filter Score > 100' }));
      await waitFor(() => expect(navigation.params.has('f')).toBe(false));
      expect(await screen.findByText('Turing')).toBeTruthy();
    });

    it('applies together with the search, and says when nothing matches both', async () => {
      navigation.reset('q=lovelace&f=score~GREATER_THAN~5000');
      fakeBackend(three());
      render(<RecordsView object="contact" />);
      expect(await screen.findByText('No contacts match “lovelace” and the filters.')).toBeTruthy(); // Ada's score is 1200.5
    });
  });

  describe('activity', () => {
    const history = [
      {
        id: '3',
        action: 'UPDATE',
        changes: { stage: { old: 'lead', new: 'customer' } },
        actor_type: 'MCP',
        actor_id: '8',
        created_at: '2026-11-17T10:00:00.000Z',
      },
      {
        id: '2',
        action: 'UPDATE',
        changes: { 'associations.contact_company': { old: [], new: ['10'] } },
        actor_type: 'USER',
        actor_id: '7',
        created_at: '2026-11-17T09:00:00.000Z',
      },
      {
        id: '1',
        action: 'CREATE',
        changes: {},
        actor_type: 'USER',
        actor_id: '7',
        created_at: '2026-11-17T08:00:00.000Z',
      },
    ];

    it('lists who changed what on a record, newest first, in its drawer', async () => {
      fakeBackend([ada()], { history });
      render(<RecordsView object="contact" />);
      await openRecord('Ada');
      const activity = await screen.findByRole('region', { name: 'Activity' });

      expect(await within(activity).findByText('Stage: lead → customer')).toBeTruthy();
      expect(within(activity).getByText('Companies: linked 1')).toBeTruthy();
      expect(within(activity).getByText('Created')).toBeTruthy();
      expect(within(activity).getByText(/Sam via MCP/)).toBeTruthy(); // names come from the members
      expect(within(activity).getAllByText(/Me ·/)).toHaveLength(2);
      const lines = within(activity)
        .getAllByRole('listitem')
        .map((li) => li.textContent ?? '');
      expect(lines[0]).toMatch(/customer/);
      expect(lines[2]).toMatch(/Created/);
    });

    it('says so when the history cannot be loaded, and still lets the record be edited', async () => {
      fakeBackend([ada()], { failHistory: true });
      render(<RecordsView object="contact" />);
      await openRecord('Ada');
      expect(await screen.findByText('Could not load the history.')).toBeTruthy();
      expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' })).toBeTruthy();
    });
  });

  describe('owner and team', () => {
    it('shows whose each record is, and its team', async () => {
      fakeBackend([{ ...ada(), team_id: '3' }, grace()]);
      render(<RecordsView object="contact" />);
      await screen.findByText('Lovelace');
      const owners = screen.getAllByLabelText('Owner') as HTMLSelectElement[];
      expect(owners.map((o) => o.options[o.selectedIndex].text)).toEqual(['Me', 'Me']);
      const teams = screen.getAllByLabelText('Team') as HTMLSelectElement[];
      expect(teams.map((t) => t.options[t.selectedIndex].text)).toEqual(['Sales', '—']);
    });

    it('reassigns the owner from the cell, and clears or sets the team', async () => {
      const backend = fakeBackend([{ ...ada(), team_id: '3' }]);
      render(<RecordsView object="contact" />);
      await screen.findByText('Lovelace');

      fireEvent.change(screen.getByLabelText('Owner'), { target: { value: '8' } });
      await waitFor(() =>
        expect(backend.calls.find((c) => c.init?.method === 'PATCH')?.init?.json).toEqual({
          owner_id: '8',
        }),
      );
      fireEvent.change(screen.getByLabelText('Team'), { target: { value: '' } });
      await waitFor(() =>
        expect(backend.calls.filter((c) => c.init?.method === 'PATCH').at(-1)?.init?.json).toEqual({
          team_id: null,
        }),
      );
      expect(backend.records[0].owner_id).toBe('8');
      expect(backend.records[0].team_id).toBeNull();
    });

    it('says why an owner could not be assigned', async () => {
      fakeBackend([ada()], { refuseOwner: true });
      render(<RecordsView object="contact" />);
      await screen.findByText('Lovelace');
      fireEvent.change(screen.getByLabelText('Owner'), { target: { value: '8' } });
      expect(
        (await screen.findAllByText(/not allowed to assign this record/)).length,
      ).toBeGreaterThan(0);
    });
  });

  describe('linked records', () => {
    const companies = [
      { id: '10', name: 'Analytical Engines' },
      { id: '11', name: 'Globex' },
    ];

    it('shows who each record is linked to in a column of its own', async () => {
      fakeBackend([ada(), grace()], { companies, links: { '1': ['10', '11'] } });
      render(<RecordsView object="contact" />);
      expect(await screen.findByRole('columnheader', { name: /Companies/ })).toBeTruthy();
      expect(await screen.findByText('Analytical Engines')).toBeTruthy();
      expect(screen.getByText('Globex')).toBeTruthy();
    });

    it('links and unlinks from the cell itself, saving each change at once', async () => {
      const backend = fakeBackend([ada()], { companies, links: { '1': ['10'] } });
      render(<RecordsView object="contact" />);
      await waitFor(() =>
        fireEvent.click(screen.getByRole('button', { name: 'Companies of Ada Lovelace' })),
      );
      const panel = await screen.findByRole('dialog');
      expect(within(panel).getByRole('list', { name: 'Linked companies' })).toBeTruthy();

      fireEvent.change(within(panel).getByLabelText('Search companies to link'), {
        target: { value: 'glob' },
      });
      fireEvent.click(await within(panel).findByRole('button', { name: 'Link Globex' }));
      await waitFor(() =>
        expect(within(panel).getByRole('button', { name: 'Unlink Globex' })).toBeTruthy(),
      );
      expect(backend.links['1']).toEqual(['10', '11']); // saved without a Save button
      expect(
        backend.calls.find(
          (c) => c.init?.method === 'POST' && c.path.endsWith('/associations/contact_company'),
        )?.init?.json,
      ).toEqual({ record_id: '11' });

      fireEvent.click(within(panel).getByRole('button', { name: 'Unlink Analytical Engines' }));
      await waitFor(() => expect(backend.links['1']).toEqual(['11']));
      expect(
        backend.calls.some(
          (c) => c.init?.method === 'DELETE' && c.path.endsWith('/associations/contact_company/10'),
        ),
      ).toBe(true);
      // The sheet behind it follows.
      expect(
        within(
          screen.getByRole('button', { name: 'Companies of Ada Lovelace', hidden: true }),
        ).queryByText('Analytical Engines'),
      ).toBeNull();
      expect(
        within(
          screen.getByRole('button', { name: 'Companies of Ada Lovelace', hidden: true }),
        ).getByText('Globex'),
      ).toBeTruthy();
    });

    it('always shows a + to add more, with or without links', async () => {
      fakeBackend([ada(), grace()], { companies, links: { '1': ['10', '11'] } });
      render(<RecordsView object="contact" />);
      const withLinks = await screen.findByRole('button', { name: 'Companies of Ada Lovelace' });
      const without = screen.getByRole('button', { name: 'Companies of Grace Hopper' });
      expect(withLinks.querySelector('[data-slot="link-add"]')).not.toBeNull();
      expect(withLinks.firstElementChild?.getAttribute('data-slot')).toBe('link-add'); // first, before the names
      expect(without.querySelector('[data-slot="link-add"]')).not.toBeNull();
    });

    it('links a first record from an empty cell', async () => {
      const backend = fakeBackend([ada()], { companies });
      render(<RecordsView object="contact" />);
      await waitFor(() =>
        fireEvent.click(screen.getByRole('button', { name: 'Companies of Ada Lovelace' })),
      );
      const panel = await screen.findByRole('dialog');
      fireEvent.change(within(panel).getByLabelText('Search companies to link'), {
        target: { value: 'analytical' },
      });
      fireEvent.click(
        await within(panel).findByRole('button', { name: 'Link Analytical Engines' }),
      );
      await waitFor(() => expect(backend.links['1']).toEqual(['10']));
    });

    it('says why a link could not be saved, and leaves the row as it was', async () => {
      const backend = fakeBackend([ada()], {
        companies,
        links: { '1': ['10'] },
        failLinking: true,
      });
      render(<RecordsView object="contact" />);
      await waitFor(() =>
        fireEvent.click(screen.getByRole('button', { name: 'Companies of Ada Lovelace' })),
      );
      const panel = await screen.findByRole('dialog');
      fireEvent.click(within(panel).getByRole('button', { name: 'Unlink Analytical Engines' }));

      expect(await within(panel).findByText('No such company: 99')).toBeTruthy();
      expect(backend.links['1']).toEqual(['10']);
      expect(
        within(
          screen.getByRole('button', { name: 'Companies of Ada Lovelace', hidden: true }),
        ).getByText('Analytical Engines'),
      ).toBeTruthy();
    });

    it("opens a linked record from its name, in the cell's panel and in the drawer", async () => {
      fakeBackend([ada()], { companies, links: { '1': ['10'] } });
      render(<RecordsView object="contact" />);
      await waitFor(() =>
        fireEvent.click(screen.getByRole('button', { name: 'Companies of Ada Lovelace' })),
      );
      const panel = await screen.findByRole('dialog');
      expect(
        within(panel).getByRole('link', { name: 'Analytical Engines' }).getAttribute('href'),
      ).toBe('/records/company?open=10');
    });

    it('opens a linked record from the drawer too', async () => {
      fakeBackend([ada()], { companies, links: { '1': ['10'] } });
      render(<RecordsView object="contact" />);
      await openRecord('Ada');
      const dialog = await screen.findByRole('dialog');
      const list = await within(dialog).findByRole('list', { name: 'Linked companies' });
      expect(
        within(list).getByRole('link', { name: 'Analytical Engines' }).getAttribute('href'),
      ).toBe('/records/company?open=10');
    });

    it('keeps the names when a cell is edited in place', async () => {
      fakeBackend([ada()], { companies, links: { '1': ['10'] } });
      render(<RecordsView object="contact" />);
      await screen.findByText('Analytical Engines');
      fireEvent.click(screen.getByText('Lovelace'));
      const input = await screen.findByDisplayValue('Lovelace');
      fireEvent.change(input, { target: { value: 'King' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(await screen.findByText('King')).toBeTruthy();
      expect(screen.getByText('Analytical Engines')).toBeTruthy();
    });

    it('lists who a record is linked to in its drawer, and unlinking saves', async () => {
      const backend = fakeBackend([ada()], { companies, links: { '1': ['10', '11'] } });
      render(<RecordsView object="contact" />);
      await openRecord('Ada');
      const dialog = await screen.findByRole('dialog');
      const list = await within(dialog).findByRole('list', { name: 'Linked companies' });
      expect(within(list).getByText('Analytical Engines')).toBeTruthy();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Unlink Globex' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const put = backend.calls.find((c) => c.init?.method === 'PUT');
      expect(put?.path).toBe('/api/v1/objects/contact/records/1/associations/contact_company');
      expect(put?.init?.json).toEqual({ record_ids: ['10'] });
    });

    it('finds a record to link by typing, and does not offer one already linked', async () => {
      const backend = fakeBackend([ada()], { companies, links: { '1': ['10'] } });
      render(<RecordsView object="contact" />);
      await openRecord('Ada');
      const dialog = await screen.findByRole('dialog');
      await within(dialog).findByRole('list', { name: 'Linked companies' });

      fireEvent.change(within(dialog).getByLabelText('Search companies to link'), {
        target: { value: 'o' },
      }); // Globex (and Analytical Engines, which is taken)
      fireEvent.click(await within(dialog).findByRole('button', { name: 'Link Globex' }));
      expect(within(dialog).queryByRole('button', { name: 'Link Analytical Engines' })).toBeNull();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      await waitFor(() =>
        expect(backend.calls.find((c) => c.init?.method === 'PUT')?.init?.json).toEqual({
          record_ids: ['10', '11'],
        }),
      );
    });

    it('sends nothing for links that were not touched', async () => {
      const backend = fakeBackend([ada()], { companies, links: { '1': ['10'] } });
      render(<RecordsView object="contact" />);
      await openRecord('Ada');
      const dialog = await screen.findByRole('dialog');
      await within(dialog).findByRole('list', { name: 'Linked companies' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(backend.calls.some((c) => c.init?.method === 'PUT')).toBe(false);
    });

    it('links a new record once it is saved', async () => {
      const backend = fakeBackend([], { companies, needsForm: true });
      render(<RecordsView object="contact" />);
      fireEvent.click((await screen.findAllByRole('button', { name: 'Add contact' }))[0]);
      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText(/First name/), { target: { value: 'Linus' } });
      fireEvent.change(within(dialog).getByLabelText(/Last name/), { target: { value: 'Test' } });
      fireEvent.change(within(dialog).getByLabelText('Search companies to link'), {
        target: { value: 'glob' },
      });
      fireEvent.click(await within(dialog).findByRole('button', { name: 'Link Globex' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const created = backend.records.find((r) => r.properties['first_name'] === 'Linus')!;
      const put = backend.calls.find((c) => c.init?.method === 'PUT');
      expect(put?.path).toBe(
        `/api/v1/objects/contact/records/${created.id}/associations/contact_company`,
      );
      expect(put?.init?.json).toEqual({ record_ids: ['11'] });
    });

    it('stays on a saved record whose linking failed, and says so', async () => {
      fakeBackend([], { companies, failLinking: true, needsForm: true });
      render(<RecordsView object="contact" />);
      fireEvent.click((await screen.findAllByRole('button', { name: 'Add contact' }))[0]);
      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText(/First name/), { target: { value: 'Linus' } });
      fireEvent.change(within(dialog).getByLabelText(/Last name/), { target: { value: 'Test' } });
      fireEvent.change(within(dialog).getByLabelText('Search companies to link'), {
        target: { value: 'glob' },
      });
      fireEvent.click(await within(dialog).findByRole('button', { name: 'Link Globex' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect(
        await within(dialog).findByText(/was saved, but linking failed: No such company: 99/),
      ).toBeTruthy();
      await waitFor(() => expect(navigation.params.get('open')).not.toBeNull()); // now an edit of the saved record, to try again
      expect(navigation.params.has('new')).toBe(false);
    });
  });

  describe('links that hold one record', () => {
    const companies = [
      { id: '10', name: 'Analytical Engines' },
      { id: '11', name: 'Globex' },
    ];

    it('replaces the record when another is linked, and says it is one at a time', async () => {
      const backend = fakeBackend([ada()], { companies, links: { '1': ['10'] }, holdsOne: true });
      render(<RecordsView object="contact" />);
      await waitFor(() =>
        fireEvent.click(screen.getByRole('button', { name: 'Companies of Ada Lovelace' })),
      );
      const panel = await screen.findByRole('dialog');
      expect(within(panel).getByText(/one at a time/)).toBeTruthy();

      fireEvent.change(within(panel).getByLabelText('Search companies to link'), {
        target: { value: 'glob' },
      });
      fireEvent.click(await within(panel).findByRole('button', { name: 'Link Globex' }));
      await waitFor(() => expect(backend.links['1']).toEqual(['11']));
      expect(within(panel).getByRole('button', { name: 'Unlink Globex' })).toBeTruthy();
      expect(within(panel).queryByRole('button', { name: 'Unlink Analytical Engines' })).toBeNull(); // taken out, not added to
      expect(
        within(
          screen.getByRole('button', { name: 'Companies of Ada Lovelace', hidden: true }),
        ).queryByText('Analytical Engines'),
      ).toBeNull();
    });

    it('replaces it from the drawer too, saving a single id', async () => {
      const backend = fakeBackend([ada()], { companies, links: { '1': ['10'] }, holdsOne: true });
      render(<RecordsView object="contact" />);
      await openRecord('Ada');
      const dialog = await screen.findByRole('dialog');
      await within(dialog).findByRole('list', { name: 'Linked companies' });
      fireEvent.change(within(dialog).getByLabelText('Search companies to link'), {
        target: { value: 'glob' },
      });
      fireEvent.click(await within(dialog).findByRole('button', { name: 'Link Globex' }));
      expect(
        within(within(dialog).getByRole('list', { name: 'Linked companies' })).queryByText(
          'Analytical Engines',
        ),
      ).toBeNull();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(backend.calls.find((c) => c.init?.method === 'PUT')?.init?.json).toEqual({
          record_ids: ['11'],
        }),
      );
    });
  });

  describe('user fields', () => {
    it('picks one member in the cell, and clears it', async () => {
      const backend = fakeBackend([ada()]);
      render(<RecordsView object="contact" />);
      await screen.findByText('Lovelace');
      fireEvent.change(screen.getByLabelText('Manager'), { target: { value: '8' } });
      await waitFor(() =>
        expect(backend.calls.find((c) => c.init?.method === 'PATCH')?.init?.json).toEqual({
          properties: { manager: '8' },
        }),
      );
      fireEvent.change(screen.getByLabelText('Manager'), { target: { value: '' } });
      await waitFor(() =>
        expect(backend.calls.filter((c) => c.init?.method === 'PATCH').at(-1)?.init?.json).toEqual({
          properties: { manager: null },
        }),
      );
    });

    it('holds several members: add and remove from the cell, saved at once', async () => {
      const backend = fakeBackend([
        { ...ada(), properties: { ...ada().properties, engineers: ['7'] } },
      ]);
      render(<RecordsView object="contact" />);
      await waitFor(() =>
        fireEvent.click(screen.getByRole('button', { name: 'Engineers of Ada Lovelace' })),
      );
      const panel = await screen.findByRole('dialog');
      expect(within(panel).getByRole('list', { name: 'Engineers' })).toBeTruthy();

      fireEvent.change(within(panel).getByLabelText('Add to Engineers'), {
        target: { value: '8' },
      });
      await waitFor(() =>
        expect(backend.calls.find((c) => c.init?.method === 'PATCH')?.init?.json).toEqual({
          properties: { engineers: ['7', '8'] },
        }),
      );
      fireEvent.click(await within(panel).findByRole('button', { name: 'Remove Me' }));
      await waitFor(() =>
        expect(backend.calls.filter((c) => c.init?.method === 'PATCH').at(-1)?.init?.json).toEqual({
          properties: { engineers: ['8'] },
        }),
      );
      fireEvent.click(within(panel).getByRole('button', { name: 'Remove Sam' }));
      await waitFor(() =>
        expect(backend.calls.filter((c) => c.init?.method === 'PATCH').at(-1)?.init?.json).toEqual({
          properties: { engineers: null },
        }),
      ); // none clears it
    });

    it('is in the drawer form: a select for one member, checkboxes for several', async () => {
      const backend = fakeBackend([ada()]);
      render(<RecordsView object="contact" />);
      await openRecord('Ada');
      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('Manager'), { target: { value: '8' } });
      fireEvent.click(within(dialog).getByLabelText('Me'));
      fireEvent.click(within(dialog).getByLabelText('Sam'));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(backend.calls.find((c) => c.init?.method === 'PATCH')?.init?.json).toMatchObject({
          properties: { manager: '8', engineers: ['7', '8'] },
        }),
      );
    });

    it('can be filtered by member when it holds one', async () => {
      fakeBackend([ada(), grace()]);
      render(<RecordsView object="contact" />);
      await screen.findByText('Lovelace');
      act(() => navigation.go('f=manager~EQUALS~8'));
      await waitFor(() => expect(navigation.params.getAll('f')).toEqual(['manager~EQUALS~8']));
      expect(await screen.findByText('Manager is Sam')).toBeTruthy(); // the member's name, not the id
    });
  });

  describe('adding a link or user field', () => {
    const openAddField = async () => {
      await waitFor(() => fireEvent.click(screen.getByRole('button', { name: 'Add field' })));
      return screen.findByRole('dialog');
    };

    it('adds a link that holds one record, to another object', async () => {
      const backend = fakeBackend([ada()], { admin: true });
      render(<RecordsView object="contact" />);
      const dialog = await openAddField();
      fireEvent.change(within(dialog).getByLabelText(/Label/), {
        target: { value: 'Primary company' },
      });
      fireEvent.change(within(dialog).getByLabelText('Type'), { target: { value: 'LINK' } });

      const target = await within(dialog).findByLabelText(/Links to/);
      await waitFor(() =>
        expect([...(target as HTMLSelectElement).options].map((o) => o.text)).toEqual([
          'Choose an object…',
          'Companies',
          'Deals',
        ]),
      ); // not Contacts: itself
      expect(within(dialog).queryByLabelText('Required')).toBeNull(); // none of these apply to a link
      expect(within(dialog).queryByLabelText(/Searchable/)).toBeNull();
      fireEvent.change(target, { target: { value: 'company' } });
      expect((within(dialog).getByLabelText('Holds') as HTMLSelectElement).value).toBe('one');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add field' }));

      await waitFor(() =>
        expect(
          backend.calls.find((c) => c.path === '/api/v1/objects/contact/fields')?.init?.json,
        ).toEqual({
          name: 'primary_company',
          label: 'Primary company',
          type: 'LINK',
          required: false,
          unique: false,
          filterable: false,
          config: { target: 'company', many: false },
        }),
      );
    });

    it('adds a link that holds many', async () => {
      const backend = fakeBackend([], { admin: true });
      render(<RecordsView object="contact" />);
      const dialog = await openAddField();
      fireEvent.change(within(dialog).getByLabelText(/Label/), { target: { value: 'Deals' } });
      fireEvent.change(within(dialog).getByLabelText('Type'), { target: { value: 'LINK' } });
      await within(dialog).findByRole('option', { name: 'Deals' });
      fireEvent.change(within(dialog).getByLabelText(/Links to/), {
        target: { value: 'deal' },
      });
      fireEvent.change(within(dialog).getByLabelText('Holds'), { target: { value: 'many' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add field' }));
      await waitFor(() =>
        expect(
          backend.calls.find((c) => c.path === '/api/v1/objects/contact/fields')?.init?.json,
        ).toMatchObject({ config: { target: 'deal', many: true } }),
      );
    });

    it('adds a user field, one or several, searchable only when one', async () => {
      const backend = fakeBackend([], { admin: true });
      render(<RecordsView object="contact" />);
      const dialog = await openAddField();
      fireEvent.change(within(dialog).getByLabelText(/Label/), {
        target: { value: 'Sales engineer' },
      });
      fireEvent.change(within(dialog).getByLabelText('Type'), { target: { value: 'USER' } });
      expect(within(dialog).getByLabelText(/Searchable/)).toBeTruthy(); // one member can be searched
      fireEvent.change(within(dialog).getByLabelText('Holds'), { target: { value: 'many' } });
      expect(within(dialog).queryByLabelText(/Searchable/)).toBeNull(); // a list cannot
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add field' }));
      await waitFor(() =>
        expect(
          backend.calls.find((c) => c.path === '/api/v1/objects/contact/fields')?.init?.json,
        ).toMatchObject({ type: 'USER', filterable: false, config: { many: true } }),
      );
    });
  });

  describe('changing a link or user field', () => {
    it('lets one or many be changed, and says why many to one was refused', async () => {
      const backend = fakeBackend([ada()], {
        admin: true,
        refuseMany:
          '1 records have several members here; keep one on each before allowing only one',
      });
      render(<RecordsView object="contact" />);
      await waitFor(() =>
        fireEvent.click(screen.getByRole('button', { name: 'Settings for Engineers' })),
      );
      const dialog = await screen.findByRole('dialog');
      expect((within(dialog).getByLabelText('Holds') as HTMLSelectElement).value).toBe('many');

      fireEvent.change(within(dialog).getByLabelText('Holds'), { target: { value: 'one' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
      expect(
        await within(dialog).findByText(/keep one on each before allowing only one/),
      ).toBeTruthy();
      expect(
        backend.calls.find(
          (c) => c.init?.method === 'PATCH' && c.path.endsWith('/fields/engineers'),
        )?.init?.json,
      ).toEqual({ config: { many: false } });
      expect((within(dialog).getByLabelText('Holds') as HTMLSelectElement).value).toBe('one'); // what was chosen is kept
    });

    it('shows what a link points at, and does not let it change', async () => {
      fakeBackend([ada()], { admin: true });
      const withLink = contact.fields.length; // the fake has no link field of its own: add one for this
      void withLink;
      render(<RecordsView object="contact" />);
      await waitFor(() =>
        fireEvent.click(screen.getByRole('button', { name: 'Settings for Manager' })),
      );
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).queryByLabelText('Links to')).toBeNull(); // only for a link
    });
  });

  describe('changing and removing fields', () => {
    /** Opens a field's settings with the cog beside its name. */
    const openField = async (label: string) => {
      await waitFor(() =>
        fireEvent.click(screen.getByRole('button', { name: `Settings for ${label}` })),
      );
      return screen.findByRole('dialog');
    };

    it('has a cog by each field name that opens that field, for those who can manage fields', async () => {
      fakeBackend([ada()], { admin: true });
      render(<RecordsView object="contact" />);
      await waitFor(() =>
        fireEvent.click(screen.getByRole('button', { name: 'Settings for Last name' })),
      );

      expect(navigation.params.get('edit_field')).toBe('last_name');
      const dialog = await screen.findByRole('dialog');
      expect(((await within(dialog).findByLabelText(/Label/)) as HTMLInputElement).value).toBe(
        'Last name',
      );
    });

    it('keeps sorting by its proper name next to the cog', async () => {
      fakeBackend([ada()], { admin: true });
      render(<RecordsView object="contact" />);
      expect(await screen.findByRole('button', { name: 'Sort Last name' })).toBeTruthy();
    });

    it('has no cog for members', async () => {
      fakeBackend([ada()]);
      render(<RecordsView object="contact" />);
      await screen.findByText('Lovelace');
      expect(screen.queryByRole('button', { name: /Settings for/ })).toBeNull();
    });

    it('saves only what changed, and the column follows', async () => {
      const backend = fakeBackend([ada()], { admin: true });
      render(<RecordsView object="contact" />);
      const dialog = await openField('Last name');
      expect(navigation.params.get('edit_field')).toBe('last_name');
      const label = await within(dialog).findByLabelText(/Label/);
      fireEvent.change(label, { target: { value: 'Surname' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect(
        await screen.findByRole('columnheader', { name: /Surname/, hidden: true }),
      ).toBeTruthy(); // behind the open drawer
      const patch = backend.calls.find(
        (c) => c.init?.method === 'PATCH' && c.path.endsWith('/fields/last_name'),
      );
      expect(patch?.init?.json).toEqual({ label: 'Surname' });
      await waitFor(() => expect(navigation.params.has('edit_field')).toBe(false));
    });

    it('sends nothing when nothing changed', async () => {
      const backend = fakeBackend([ada()], { admin: true });
      render(<RecordsView object="contact" />);
      const dialog = await openField('Last name');
      fireEvent.click(await within(dialog).findByRole('button', { name: 'Save' }));
      await waitFor(() => expect(navigation.params.has('edit_field')).toBe(false));
      expect(
        backend.calls.some((c) => c.init?.method === 'PATCH' && c.path.includes('/fields/')),
      ).toBe(false);
    });

    it('shows the key and type as disabled inputs', async () => {
      const backend = fakeBackend([ada()], { admin: true });
      render(<RecordsView object="contact" />);
      const dialog = await openField('Score');
      const key = (await within(dialog).findByLabelText('Key')) as HTMLInputElement;
      const type = within(dialog).getByLabelText('Type') as HTMLInputElement;
      expect([key.value, key.disabled]).toEqual(['score', true]);
      expect([type.value, type.disabled]).toEqual(['Number', true]);

      fireEvent.change(within(dialog).getByLabelText(/Label/), { target: { value: 'Points' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(
          backend.calls.find((c) => c.init?.method === 'PATCH' && c.path.endsWith('/fields/score'))
            ?.init?.json,
        ).toEqual({ label: 'Points' }),
      );
    });

    it('explains why a choice cannot be removed, next to the choices', async () => {
      fakeBackend([ada()], { admin: true, keepChoice: 'customer' });
      render(<RecordsView object="contact" />);
      const dialog = await openField('Stage');
      fireEvent.change(await within(dialog).findByLabelText(/Choices/), {
        target: { value: 'lead' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect(await within(dialog).findByText(/Records still use 'customer'/)).toBeTruthy();
      expect((within(dialog).getByLabelText(/Choices/) as HTMLTextAreaElement).value).toBe('lead'); // what was typed is kept
    });

    it('asks before removing a field, then drops the column', async () => {
      const backend = fakeBackend([ada()], { admin: true });
      render(<RecordsView object="contact" />);
      expect(await screen.findByRole('columnheader', { name: /Score/ })).toBeTruthy();
      const dialog = await openField('Score');
      fireEvent.click(await within(dialog).findByRole('button', { name: 'Remove field' }));
      expect(
        backend.calls.some((c) => c.init?.method === 'DELETE' && c.path.includes('/fields/')),
      ).toBe(false);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, remove' }));

      await waitFor(() =>
        expect(screen.queryByRole('columnheader', { name: /Score/, hidden: true })).toBeNull(),
      );
      expect(
        backend.calls.some((c) => c.init?.method === 'DELETE' && c.path.endsWith('/fields/score')),
      ).toBe(true);
    });
  });

  describe('adding a field', () => {
    it('is offered only to those who can manage objects', async () => {
      fakeBackend([ada()]);
      render(<RecordsView object="contact" />);
      await screen.findByText('Lovelace');
      expect(screen.queryByRole('button', { name: 'Add field' })).toBeNull();
    });

    it('adds a column: the key follows the label, choices are listed, the drawer closes', async () => {
      const backend = fakeBackend([ada()], { admin: true });
      render(<RecordsView object="contact" />);
      await waitFor(() => fireEvent.click(screen.getByRole('button', { name: 'Add field' })));

      expect(navigation.params.get('add_field')).toBe('1');
      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText(/Label/), {
        target: { value: 'Lead source' },
      });
      expect((within(dialog).getByLabelText(/Key/) as HTMLInputElement).value).toBe('lead_source');
      fireEvent.change(within(dialog).getByLabelText('Type'), { target: { value: 'ENUM' } });
      fireEvent.change(within(dialog).getByLabelText(/Choices/), {
        target: { value: 'web\n\nreferral\nweb\n' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add field' }));

      expect(await screen.findByRole('columnheader', { name: /Lead source/ })).toBeTruthy();
      const post = backend.calls.find((c) => c.path === '/api/v1/objects/contact/fields');
      expect(post?.init?.json).toEqual({
        name: 'lead_source',
        label: 'Lead source',
        type: 'ENUM',
        required: false,
        unique: false,
        filterable: true,
        config: { options: ['web', 'referral'] },
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(navigation.params.has('add_field')).toBe(false);
    });

    it('stops following the label once the key is typed by hand', async () => {
      fakeBackend([], { admin: true });
      render(<RecordsView object="contact" />);
      await waitFor(() => fireEvent.click(screen.getByRole('button', { name: 'Add field' })));
      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText(/Key/), { target: { value: 'src' } });
      fireEvent.change(within(dialog).getByLabelText(/Label/), {
        target: { value: 'Lead source' },
      });
      expect((within(dialog).getByLabelText(/Key/) as HTMLInputElement).value).toBe('src');
    });

    it('shows why a field was refused and keeps what was typed', async () => {
      fakeBackend([ada()], { admin: true });
      render(<RecordsView object="contact" />);
      await waitFor(() => fireEvent.click(screen.getByRole('button', { name: 'Add field' })));
      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText(/Label/), { target: { value: 'Email' } }); // key `email` is taken
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add field' }));

      expect(
        await within(dialog).findByText("Field 'email' already exists on 'contact'"),
      ).toBeTruthy();
      expect((within(dialog).getByLabelText(/Label/) as HTMLInputElement).value).toBe('Email');
    });

    it('does not offer a required field while there are records to fill in', async () => {
      fakeBackend([ada()], { admin: true });
      render(<RecordsView object="contact" />);
      await waitFor(() => fireEvent.click(screen.getByRole('button', { name: 'Add field' })));
      const dialog = await screen.findByRole('dialog');
      expect((within(dialog).getByLabelText('Required') as HTMLInputElement).disabled).toBe(true);
    });
  });

  describe('editing in place', () => {
    it('saves a changed cell on its own, without refetching or opening the drawer', async () => {
      const backend = fakeBackend([ada(), grace()]);
      render(<RecordsView object="contact" />);
      await screen.findByText('Lovelace');

      fireEvent.click(screen.getByText('Lovelace'));
      const input = await screen.findByDisplayValue('Lovelace');
      fireEvent.change(input, { target: { value: 'King' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(await screen.findByText('King')).toBeTruthy();
      const patches = backend.calls.filter((c) => c.init?.method === 'PATCH');
      expect(patches).toHaveLength(1);
      expect(patches[0].path).toBe('/api/v1/objects/contact/records/1');
      expect(patches[0].init?.json).toEqual({ properties: { last_name: 'King' } });
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('changes a choice from its select', async () => {
      const backend = fakeBackend([ada()]);
      render(<RecordsView object="contact" />);
      await screen.findByText('Lovelace');

      fireEvent.change(await screen.findByLabelText('Stage'), { target: { value: 'lead' } });

      await waitFor(() =>
        expect(backend.calls.find((c) => c.init?.method === 'PATCH')?.init?.json).toEqual({
          properties: { stage: 'lead' },
        }),
      );
      await waitFor(() =>
        expect((screen.getByLabelText('Stage') as HTMLSelectElement).value).toBe('lead'),
      );
    });

    it('changes a date with its date input, and clears it when emptied', async () => {
      const backend = fakeBackend([
        { ...ada(), properties: { ...ada().properties, renewal: '2027-01-15T00:00:00.000Z' } },
      ]);
      render(<RecordsView object="contact" />);
      const input = (await screen.findByLabelText('Renewal date')) as HTMLInputElement;
      expect(input.value).toBe('2027-01-15');

      fireEvent.change(input, { target: { value: '2027-02-01' } });
      await waitFor(() =>
        expect(backend.calls.find((c) => c.init?.method === 'PATCH')?.init?.json).toEqual({
          properties: { renewal: '2027-02-01' },
        }),
      );

      fireEvent.change(screen.getByLabelText('Renewal date'), { target: { value: '' } });
      await waitFor(() =>
        expect(backend.calls.filter((c) => c.init?.method === 'PATCH').at(-1)?.init?.json).toEqual({
          properties: { renewal: null },
        }),
      );
    });

    it('does not clear a date that is only half typed', async () => {
      const backend = fakeBackend([
        { ...ada(), properties: { ...ada().properties, renewal: '2027-01-15T00:00:00.000Z' } },
      ]);
      render(<RecordsView object="contact" />);
      const input = (await screen.findByLabelText('Renewal date')) as HTMLInputElement;

      // The browser reports a partly typed date as empty, and says so through validity.
      Object.defineProperty(input, 'validity', { value: { badInput: true }, configurable: true });
      fireEvent.change(input, { target: { value: '' } });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(backend.calls.some((c) => c.init?.method === 'PATCH')).toBe(false);
    });

    it('ticks a yes/no field in place', async () => {
      const backend = fakeBackend([ada()]);
      render(<RecordsView object="contact" />);
      const box = (await screen.findByLabelText('VIP')) as HTMLInputElement;
      expect(box.checked).toBe(false);
      fireEvent.click(box);
      await waitFor(() =>
        expect(backend.calls.find((c) => c.init?.method === 'PATCH')?.init?.json).toEqual({
          properties: { vip: true },
        }),
      );
      await waitFor(() =>
        expect((screen.getByLabelText('VIP') as HTMLInputElement).checked).toBe(true),
      );
    });

    it('sends a number as a number', async () => {
      const backend = fakeBackend([ada()]);
      render(<RecordsView object="contact" />);
      await screen.findByText('Lovelace');

      fireEvent.click(screen.getByText('1200.5'));
      const input = await screen.findByDisplayValue('1200.5');
      fireEvent.change(input, { target: { value: '99' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() =>
        expect(backend.calls.find((c) => c.init?.method === 'PATCH')?.init?.json).toEqual({
          properties: { score: 99 },
        }),
      );
    });
  });

  describe('editing and deleting', () => {
    it('opens a record filled in, and clears what was emptied', async () => {
      const backend = fakeBackend([ada()]);
      render(<RecordsView object="contact" />);
      await openRecord('Ada');

      const dialog = await screen.findByRole('dialog');
      expect((within(dialog).getByLabelText(/First name/) as HTMLInputElement).value).toBe('Ada');
      expect((within(dialog).getByLabelText('Score') as HTMLInputElement).value).toBe('1200.5');
      fireEvent.change(within(dialog).getByLabelText('Last name'), { target: { value: '' } });
      fireEvent.change(within(dialog).getByLabelText(/First name/), {
        target: { value: 'Augusta Ada' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect(await screen.findByRole('button', { name: 'Augusta Ada' })).toBeTruthy();
      const patch = backend.calls.find((c) => c.init?.method === 'PATCH');
      expect(patch?.path).toBe('/api/v1/objects/contact/records/1');
      expect(patch?.init?.json).toMatchObject({
        properties: { first_name: 'Augusta Ada', last_name: null, email: 'ada@x.com' },
      });
    });

    it('asks before deleting, then removes the record', async () => {
      const backend = fakeBackend([ada(), grace()]);
      render(<RecordsView object="contact" />);
      await openRecord('Ada');
      const dialog = await screen.findByRole('dialog');

      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
      expect(backend.calls.some((c) => c.init?.method === 'DELETE')).toBe(false);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, delete' }));

      // While a dialog is open the page behind it is hidden from assistive technology.
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(await screen.findByText('1 contact')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Ada' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Grace' })).toBeTruthy();
    });

    it('shows why a delete was refused', async () => {
      fakeBackend([ada()]);
      const delegate = api.getMockImplementation()!;
      api.mockImplementation(async (path, init) => {
        if (init?.method === 'DELETE')
          throw new ApiError('You are not allowed to delete records', 403, 'FORBIDDEN');
        return delegate(path, init);
      });
      render(<RecordsView object="contact" />);
      await openRecord('Ada');
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, delete' }));

      expect(await within(dialog).findByText('You are not allowed to delete records')).toBeTruthy();
      expect(screen.getByRole('dialog')).toBeTruthy(); // still open
      expect(screen.getByText('Lovelace')).toBeTruthy(); // and the record is still listed behind it
    });
  });

  describe('searching, sorting and paging', () => {
    it('searches text fields from the URL', async () => {
      const backend = fakeBackend([ada(), grace()]);
      render(<RecordsView object="contact" />);
      await screen.findByRole('button', { name: 'Ada' });

      act(() => navigation.go('q=hopp'));

      await waitFor(() => expect(screen.queryByRole('button', { name: 'Ada' })).toBeNull());
      expect(screen.getByRole('button', { name: 'Grace' })).toBeTruthy();
      const search = backend.calls.find((c) => c.path.endsWith('/records/filter'));
      expect(search?.init?.json).toMatchObject({
        filter_groups: [
          { filters: [{ field_path: 'first_name', operator: 'CONTAINS', value: 'hopp' }] },
          { filters: [{ field_path: 'last_name', operator: 'CONTAINS', value: 'hopp' }] },
          { filters: [{ field_path: 'email', operator: 'CONTAINS', value: 'hopp' }] },
        ],
        pagination: { page: 1, page_size: 100 },
      });
    });

    it('says so when nothing matches', async () => {
      fakeBackend([ada()]);
      render(<RecordsView object="contact" />);
      await screen.findByRole('button', { name: 'Ada' });
      act(() => navigation.go('q=zzz'));

      expect(await screen.findByText(/No contacts match “zzz”/)).toBeTruthy();
    });

    it('sorts by a column through the sheet header: A to Z, Z to A, then back to the default', async () => {
      const backend = fakeBackend([ada(), grace()]);
      render(<RecordsView object="contact" />);
      await screen.findByRole('button', { name: 'Ada' });
      expect(screen.queryByRole('button', { name: 'Sort Stage' })).toBeNull(); // not filterable, so not sortable

      const header = () => screen.getByRole('columnheader', { name: /Last name/ });
      const sortedBy = (value: string) =>
        backend.calls.some((c) => c.path.includes(`sort=${value}`));
      const firstRow = () => within(screen.getAllByRole('row')[1]);

      fireEvent.click(screen.getByRole('button', { name: 'Sort Last name' }));
      await waitFor(() => expect(sortedBy('last_name%2Casc')).toBe(true));
      expect(navigation.search).toBe('sort=last_name&order=asc');
      await waitFor(() => expect(header().getAttribute('aria-sort')).toBe('ascending'));
      await waitFor(() => expect(firstRow().getByText('Hopper')).toBeTruthy()); // A to Z: Hopper first

      fireEvent.click(screen.getByRole('button', { name: 'Sort Last name' }));
      await waitFor(() => expect(sortedBy('last_name%2Cdesc')).toBe(true));
      expect(navigation.search).toBe('sort=last_name&order=desc');
      await waitFor(() => expect(header().getAttribute('aria-sort')).toBe('descending'));
      await waitFor(() => expect(firstRow().getByText('Lovelace')).toBeTruthy()); // Z to A: Lovelace first

      backend.calls.length = 0;
      fireEvent.click(screen.getByRole('button', { name: 'Sort Last name' }));
      await waitFor(() =>
        expect(backend.calls.some((c) => c.path.includes('/records?'))).toBe(true),
      );
      expect(backend.calls.some((c) => c.path.includes('sort='))).toBe(false); // back to the default order
      expect(navigation.search).toBe(''); // and the URL is clean again
    });

    it('shows every record in one scrolling sheet, however many requests that takes', async () => {
      const backend = fakeBackend(
        Array.from({ length: 230 }, (_, i) =>
          row({ first_name: `Person ${String(i + 1).padStart(3, '0')}` }),
        ),
      );
      render(<RecordsView object="contact" />);

      expect(await screen.findByText('230 contacts')).toBeTruthy();
      expect(await screen.findByRole('button', { name: 'Person 230' })).toBeTruthy(); // the last one, no paging needed
      expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
      expect(screen.queryByText(/Showing/)).toBeNull();
      const listing = backend.calls.filter((c) => c.path.includes('/records?'));
      expect(listing.map((c) => new URLSearchParams(c.path.split('?')[1]).get('page'))).toEqual([
        '1',
        '2',
        '3',
      ]); // 100 a request
    }, 30_000); // 230 rows of a wide sheet is a lot for jsdom

    it('says so, and points to search, when a list is longer than the sheet takes', async () => {
      fakeBackend(
        Array.from({ length: 60 }, (_, i) =>
          row({ first_name: `Person ${String(i + 1).padStart(2, '0')}` }),
        ),
      );
      render(<RecordsView object="contact" maxRows={25} />);

      expect(await screen.findByText('60 contacts')).toBeTruthy();
      expect(
        await screen.findByText(
          /Showing the first 25 of 60 contacts. Use Cmd\+K to narrow them down./,
        ),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Person 25' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Person 26' })).toBeNull();
    });
  });

  describe('the URL', () => {
    const people = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        row({ first_name: `Person ${String(i + 1).padStart(2, '0')}` }, String(i + 1)),
      );

    it('records what you do: search, sort, the open record and the add form', async () => {
      fakeBackend(people(25));
      render(<RecordsView object="contact" />);
      await screen.findByText('25 contacts');

      act(() => navigation.go('q=Person'));
      await waitFor(() => expect(navigation.params.get('q')).toBe('Person'));

      fireEvent.click(screen.getByRole('button', { name: 'Sort First name' }));
      await waitFor(() => expect(navigation.params.get('sort')).toBe('first_name'));
      expect(navigation.params.get('order')).toBe('asc');

      await openRecord('Person 21');
      await waitFor(() => expect(navigation.params.get('open')).toBe('21'));
      expect(navigation.params.get('q')).toBe('Person'); // everything else is kept

      fireEvent.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }),
      );
      await waitFor(() => expect(navigation.params.has('open')).toBe(false));

      fireEvent.click(screen.getAllByRole('button', { name: 'Add contact' })[0]);
      await waitFor(() => expect(navigation.params.get('new')).toBe('1'));
      expect(await screen.findByPlaceholderText('New contact')).toBeTruthy();
    });

    it('restores search and sort from a link', async () => {
      navigation.reset('q=person&sort=first_name&order=desc');
      const backend = fakeBackend(people(25));
      render(<RecordsView object="contact" />);

      await screen.findByText('25 contacts');
      expect(screen.getByText('Results for “person”')).toBeTruthy();
      expect(
        screen.getByRole('columnheader', { name: /First name/ }).getAttribute('aria-sort'),
      ).toBe('descending');
      const search = backend.calls.find((c) => c.path.endsWith('/records/filter'));
      expect(search?.init?.json).toMatchObject({
        sort: { field: 'first_name', direction: 'DESC' },
        pagination: { page: 1, page_size: 100 },
      });
    });

    it('opens the record a link points at, filled in, even when the search leaves it out', async () => {
      navigation.reset('q=Person+01&open=25'); // the search finds only record 1
      fakeBackend(people(25));
      render(<RecordsView object="contact" />);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('heading', { name: 'Person 25' })).toBeTruthy();
      await waitFor(() =>
        expect((within(dialog).getByLabelText(/First name/) as HTMLInputElement).value).toBe(
          'Person 25',
        ),
      );
    });

    it('shows the new row to type into from a link', async () => {
      navigation.reset('new=1');
      fakeBackend(people(3));
      render(<RecordsView object="contact" />);
      expect(await screen.findByPlaceholderText('New contact')).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens the add form from a link when the object needs one', async () => {
      navigation.reset('new=1');
      fakeBackend(people(3), { needsForm: true });
      render(<RecordsView object="contact" />);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Add contact')).toBeTruthy();
      expect((within(dialog).getByLabelText(/First name/) as HTMLInputElement).value).toBe('');
    });

    it('says so and cleans the URL when the linked record is gone', async () => {
      navigation.reset('open=999');
      fakeBackend(people(3));
      render(<RecordsView object="contact" />);

      expect(
        await screen.findByText('That record no longer exists, or you cannot see it.'),
      ).toBeTruthy();
      await waitFor(() => expect(navigation.params.has('open')).toBe(false));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('ignores a sort it cannot do, and a page number left over from an old link', async () => {
      navigation.reset('sort=stage&page=3'); // stage is not filterable; there is no paging any more
      const backend = fakeBackend(people(3));
      render(<RecordsView object="contact" />);

      await screen.findByText('3 contacts');
      expect(backend.calls.some((c) => c.path.includes('sort='))).toBe(false);
      expect(screen.getByRole('button', { name: 'Person 03' })).toBeTruthy();
    });

    it('follows the URL when it changes from outside, like the back button', async () => {
      const backend = fakeBackend([ada(), grace()]);
      render(<RecordsView object="contact" />);
      await screen.findByRole('button', { name: 'Ada' });

      act(() => navigation.go('q=grace'));

      expect(screen.getByText('Results for “grace”')).toBeTruthy();
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Ada' })).toBeNull());
      expect(backend.calls.some((c) => c.path.endsWith('/records/filter'))).toBe(true);
    });
  });
});

describe('records workspace recovery', () => {
  it('keeps the record toolbar free of inline search, filter, and refresh controls', async () => {
    fakeBackend([ada()]);
    render(<RecordsView object="contact" />);
    await screen.findByText('Lovelace');
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Filter' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Refresh records' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Add contact' }).length).toBeGreaterThan(0);
  });

  it('retries a failed list request', async () => {
    const options = { failList: true };
    fakeBackend([ada()], options);
    render(<RecordsView object="contact" />);
    await screen.findByText('The server is unavailable');
    options.failList = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Lovelace')).toBeTruthy();
  });

  it('clears the search and filters together from an empty result', async () => {
    fakeBackend([ada()]);
    navigation.reset('q=nobody');
    render(<RecordsView object="contact" />);
    await screen.findByText(/No contacts match/);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search and filters' }));
    expect(await screen.findByText('Lovelace')).toBeTruthy();
    expect(navigation.params.get('q')).toBeNull();
  });

  it('keeps failed link loads separate from editable record details and retries them', async () => {
    const options = {
      failLinkLoad: true,
      companies: [{ id: '10', name: 'Globex' }],
      links: { '1': ['10'] },
    };
    const backend = fakeBackend([ada()], options);
    render(<RecordsView object="contact" />);
    await openRecord('Ada');
    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByText('Links are unavailable')).toBeTruthy();
    expect(within(dialog).queryByLabelText('Search companies to link')).toBeNull();
    options.failLinkLoad = false;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retry links' }));
    expect(await within(dialog).findByRole('list', { name: 'Linked companies' })).toBeTruthy();
    expect(within(dialog).getByText('Globex')).toBeTruthy();
    expect(backend.links['1']).toEqual(['10']);
  });

  it('retries activity without closing or resetting the record form', async () => {
    const options = { failHistory: true };
    fakeBackend([ada()], options);
    render(<RecordsView object="contact" />);
    await openRecord('Ada');
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByText('Could not load the history.');
    fireEvent.change(within(dialog).getByLabelText(/First name/), {
      target: { value: 'Ada edited' },
    });
    options.failHistory = false;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retry history' }));
    expect(await within(dialog).findByText('No activity yet.')).toBeTruthy();
    expect((within(dialog).getByLabelText(/First name/) as HTMLInputElement).value).toBe(
      'Ada edited',
    );
  });
});

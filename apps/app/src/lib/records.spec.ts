import {
  columnsFor,
  editableFields,
  emptyValues,
  formatValue,
  describeFilter,
  describeHistory,
  encodeFilter,
  parseFilters,
  editFromField,
  fieldPatchBody,
  keyFromLabel,
  newFieldBody,
  propertiesFromValues,
  searchBody,
  searchableFields,
  valuesFromRecord,
  type FieldDef,
} from './records';

const field = (name: string, type: FieldDef['type'], over: Partial<FieldDef> = {}): FieldDef => ({
  name,
  label: name,
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

const fields = [
  field('first_name', 'TEXT', { required: true, filterable: true }),
  field('email', 'EMAIL', { filterable: true }),
  field('amount', 'NUMBER', { filterable: true }),
  field('active', 'BOOLEAN'),
  field('closes', 'TIMESTAMP', { filterable: true }),
  field('stage', 'ENUM', { config: { options: ['new', 'won'] } }),
  field('source', 'TEXT', { read_only: true }),
  field('secret', 'TEXT', { sensitive: true }),
];

describe('form values', () => {
  it('starts blank, skipping read-only fields', () => {
    const values = emptyValues(fields);
    expect(values).toMatchObject({ first_name: '', amount: '', active: false, stage: '' });
    expect('source' in values).toBe(false);
    expect(editableFields(fields).map((f) => f.name)).not.toContain('source');
  });

  it('is filled from a record, turning timestamps into dates', () => {
    const values = valuesFromRecord(fields, {
      first_name: 'Ada',
      amount: 1200.5,
      active: true,
      closes: '2026-12-31T00:00:00.000Z',
    });
    expect(values).toMatchObject({
      first_name: 'Ada',
      amount: '1200.5',
      active: true,
      closes: '2026-12-31',
      email: '',
      stage: '',
    });
  });
});

describe('propertiesFromValues', () => {
  const values = {
    first_name: ' Ada ',
    email: '',
    amount: '1200.5',
    active: true,
    closes: '2026-12-31',
    stage: '',
    secret: '',
  };

  it('trims text, converts numbers and leaves blanks out when creating', () => {
    expect(propertiesFromValues(fields, values, 'create')).toEqual({
      first_name: 'Ada',
      amount: 1200.5,
      active: true,
      closes: '2026-12-31',
      // email, stage and secret are blank, so absent
    });
  });

  it('clears blank fields when updating, so emptying an input removes the value', () => {
    const update = propertiesFromValues(fields, values, 'update');
    expect(update['email']).toBeNull();
    expect(update['stage']).toBeNull();
    expect(update['first_name']).toBe('Ada');
  });

  it('never sends read-only fields, and always sends a checkbox', () => {
    const create = propertiesFromValues(
      fields,
      { ...values, source: 'import', active: false },
      'create',
    );
    expect('source' in create).toBe(false);
    expect(create['active']).toBe(false);
  });
});

describe('formatValue', () => {
  it('formats each kind of value, and shows nothing for a missing one', () => {
    expect(formatValue(fields[2], 1234.567)).toBe(
      new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(1234.567),
    );
    expect(formatValue(fields[3], true)).toBe('Yes');
    expect(formatValue(fields[3], false)).toBe('No');
    expect(formatValue(fields[4], '2026-12-31T00:00:00.000Z')).toMatch(/2026/);
    expect(formatValue(fields[0], null)).toBe('');
    expect(formatValue(fields[0], undefined)).toBe('');
    expect(formatValue(fields[4], 'not a date')).toBe('not a date');
  });

  it("shows a date as stored, whatever the viewer's time zone", () => {
    expect(formatValue(fields[4], '2026-12-31T00:00:00.000Z')).toMatch(/31/);
  });
});

describe('search and columns', () => {
  it('searches only filterable text fields, any of which may match', () => {
    expect(searchableFields(fields).map((f) => f.name)).toEqual(['first_name', 'email']);
    const body = searchBody(fields, 'ada', 2, 20, { field: 'amount', direction: 'desc' });
    expect(body.filter_groups).toEqual([
      { filters: [{ field_path: 'first_name', operator: 'CONTAINS', value: 'ada' }] },
      { filters: [{ field_path: 'email', operator: 'CONTAINS', value: 'ada' }] },
    ]);
    expect(body.pagination).toEqual({ page: 2, page_size: 20 });
    expect(body.sort).toEqual({ field: 'amount', direction: 'DESC' });
    expect('sort' in searchBody(fields, 'ada', 1, 20, null)).toBe(false);
  });

  it('shows every field except sensitive ones', () => {
    expect(columnsFor(fields).map((f) => f.name)).not.toContain('secret');
    expect(columnsFor(fields)).toHaveLength(fields.length - 1);
  });
});

describe('keyFromLabel', () => {
  it('makes a key from a label', () => {
    expect(keyFromLabel('Lead source')).toBe('lead_source');
    expect(keyFromLabel('  Année – du contrat! ')).toBe('annee_du_contrat');
    expect(keyFromLabel('2nd phone')).toBe('f_2nd_phone');
    expect(keyFromLabel('!!!')).toBe('');
  });
});

describe('newFieldBody', () => {
  const base = {
    label: ' Source ',
    name: 'source',
    type: 'TEXT' as const,
    required: false,
    unique: false,
    filterable: true,
    options: '',
  };
  it('trims the label and sends no config for a plain field', () => {
    expect(newFieldBody(base)).toEqual({
      name: 'source',
      label: 'Source',
      type: 'TEXT',
      required: false,
      unique: false,
      filterable: true,
    });
  });
  it('lists the choices once each, without blanks, for a choice field only', () => {
    expect(newFieldBody({ ...base, type: 'ENUM', options: 'a\n\n b \na' }).config).toEqual({
      options: ['a', 'b'],
    });
    expect(newFieldBody({ ...base, options: 'a' })).not.toHaveProperty('config');
  });
});

describe('fieldPatchBody', () => {
  const stage = field('stage', 'ENUM', {
    label: 'Stage',
    filterable: false,
    config: { options: ['a', 'b'] },
  });
  it('is empty when nothing changed', () => {
    expect(fieldPatchBody(stage, editFromField(stage))).toEqual({});
  });
  it('holds only what changed', () => {
    expect(
      fieldPatchBody(stage, { ...editFromField(stage), label: ' Phase ', filterable: true }),
    ).toEqual({ label: 'Phase', filterable: true });
    expect(fieldPatchBody(stage, { ...editFromField(stage), required: true })).toEqual({
      required: true,
    });
  });
  it('sends choices once each, and only for a choice field', () => {
    expect(fieldPatchBody(stage, { ...editFromField(stage), options: 'a\n\nb\nc\nc' })).toEqual({
      config: { options: ['a', 'b', 'c'] },
    });
    const text = field('notes', 'TEXT');
    expect(fieldPatchBody(text, { ...editFromField(text), options: 'x' })).toEqual({});
  });
});

describe('describeHistory', () => {
  const def = {
    fields: [
      field('stage', 'ENUM', { label: 'Stage' }),
      field('due', 'TIMESTAMP', { label: 'Due' }),
      field('vip', 'BOOLEAN', { label: 'VIP' }),
    ],
    associations: [
      {
        name: 'company',
        label: 'Companies',
        singular_label: 'Company',
        target: 'company',
        many: true,
        side: 'forward' as const,
        field: 'companies',
      },
    ],
  };
  const entry = (
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    changes: Record<string, { old: unknown; new: unknown }> = {},
  ) => ({
    id: '1',
    action,
    changes,
    actor_type: 'USER',
    actor_id: '7',
    created_at: '2026-11-17T00:00:00.000Z',
  });

  it('says what was created or deleted', () => {
    expect(describeHistory(def, entry('CREATE', { stage: { old: null, new: 'lead' } }))).toEqual([
      'Created',
    ]);
    expect(describeHistory(def, entry('DELETE'))).toEqual(['Deleted']);
  });

  it("puts a field change in words, with the field's label", () => {
    expect(
      describeHistory(
        def,
        entry('UPDATE', {
          stage: { old: 'lead', new: 'won' },
          due: { old: null, new: '2027-01-15T00:00:00.000Z' },
          vip: { old: false, new: true },
        }),
      ),
    ).toEqual(['Stage: lead → won', 'Due: empty → 2027-01-15', 'VIP: No → Yes']);
  });

  it('says how many records were linked and unlinked, from either end', () => {
    expect(
      describeHistory(
        def,
        entry('UPDATE', { 'associations.company': { old: ['1'], new: ['1', '2', '3'] } }),
      ),
    ).toEqual(['Companies: linked 2']);
    expect(
      describeHistory(
        def,
        entry('UPDATE', { 'associations.company': { old: ['1', '2'], new: ['2'] } }),
      ),
    ).toEqual(['Companies: unlinked 1']);
    expect(
      describeHistory(def, entry('UPDATE', { 'associations.company': { old: null, new: '9' } })),
    ).toEqual(['Companies: linked 1']);
    expect(
      describeHistory(def, entry('UPDATE', { 'associations.company': { old: '9', new: null } })),
    ).toEqual(['Companies: unlinked 1']);
  });

  it('falls back to the key for a field that has since been removed', () => {
    expect(describeHistory(def, entry('UPDATE', { gone: { old: 'a', new: 'b' } }))).toEqual([
      'gone: a → b',
    ]);
  });
});

describe('column filters', () => {
  const fields = [
    field('name', 'TEXT', { label: 'Name', filterable: true }),
    field('amount', 'NUMBER', { label: 'Amount', filterable: true }),
    field('stage', 'ENUM', { label: 'Stage', filterable: true }),
    field('vip', 'BOOLEAN', { label: 'VIP', filterable: true }),
    field('notes', 'TEXT', { label: 'Notes' }), // not filterable
  ];

  it('round-trips through the URL form, values with ~ included', () => {
    const f = { field: 'name', op: 'CONTAINS' as const, value: 'a~b' };
    expect(encodeFilter(f)).toBe('name~CONTAINS~a~b');
    expect(parseFilters([encodeFilter(f)], fields)).toEqual([f]);
  });

  it('leaves out what cannot be honoured', () => {
    expect(
      parseFilters(
        [
          'nothing~EQUALS~x',
          'notes~EQUALS~x',
          'amount~CONTAINS~1',
          'amount~GREATER_THAN~abc',
          'name~CONTAINS~',
          'vip~EQUALS~maybe',
          'garbage',
          'stage~EQUALS~won',
        ],
        fields,
      ),
    ).toEqual([{ field: 'stage', op: 'EQUALS', value: 'won' }]);
  });

  it('needs no value for emptiness', () => {
    expect(parseFilters(['name~IS_NULL~'], fields)).toEqual([
      { field: 'name', op: 'IS_NULL', value: '' },
    ]);
  });

  it('puts every filter into every search group, so both must hold', () => {
    const body = searchBody(
      [
        field('name', 'TEXT', { filterable: true }),
        field('city', 'TEXT', { filterable: true }),
        field('amount', 'NUMBER', { filterable: true }),
      ],
      'ada',
      1,
      100,
      null,
      [{ field: 'amount', op: 'GREATER_THAN', value: '5' }],
    );
    expect(body.filter_groups).toHaveLength(2); // searched in each text field
    for (const group of body.filter_groups)
      expect(group.filters.at(-1)).toEqual({
        field_path: 'amount',
        operator: 'GREATER_THAN',
        value: 5,
      });
  });

  it('filters without a search text in a single group', () => {
    const body = searchBody(fields, '', 1, 100, null, [
      { field: 'vip', op: 'EQUALS', value: 'true' },
      { field: 'name', op: 'IS_NULL', value: '' },
    ]);
    expect(body.filter_groups).toEqual([
      {
        filters: [
          { field_path: 'vip', operator: 'EQUALS', value: true },
          { field_path: 'name', operator: 'IS_NULL' },
        ],
      },
    ]);
  });

  it('says a filter in words', () => {
    expect(describeFilter(fields, { field: 'stage', op: 'NOT_EQUALS', value: 'won' })).toBe(
      'Stage is not won',
    );
    expect(describeFilter(fields, { field: 'amount', op: 'GREATER_THAN', value: '10' })).toBe(
      'Amount > 10',
    );
    expect(describeFilter(fields, { field: 'vip', op: 'EQUALS', value: 'true' })).toBe(
      'VIP is yes',
    );
    expect(describeFilter(fields, { field: 'name', op: 'IS_NULL', value: '' })).toBe(
      'Name is empty',
    );
  });
});

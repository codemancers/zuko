/** The shapes the records API speaks, and the translation between them and a form. */

export type FieldType =
  | 'TEXT'
  | 'EMAIL'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'TIMESTAMP'
  | 'ENUM'
  | 'LINK'
  | 'USER';

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  unique: boolean;
  filterable: boolean;
  read_only: boolean;
  sensitive: boolean;
  max_length: number | null;
  /** `target` and `link` are for a link field; `many` for a link or user field. */
  config: { options?: string[]; target?: string; many?: boolean; link?: string };
}

export interface ObjectDef {
  id: string;
  name: string;
  label: string;
  plural_label: string;
  object_kind: 'STANDARD' | 'CUSTOM';
  version: number;
  fields: FieldDef[];
  /** The other kinds of record this one can be linked to. */
  associations?: AssociationDef[];
}

/** One link, as this object sees it: a column showing the records linked, and how to change them. */
export interface AssociationDef {
  /** The link's name, as used in the API. */
  name: string;
  /** The column's heading. */
  label: string;
  /** What one linked record is called. */
  singular_label: string;
  /** The other object's name, to find and open the records linked. */
  target: string;
  /** Whether a record here holds many linked records, or one. */
  many: boolean;
  /** `forward` on the object that holds the link field, `reverse` on the one it points at. */
  side: 'forward' | 'reverse';
  field: string | null;
}

/** A record seen as a link: enough to show it. */
export interface Linked {
  id: string;
  label: string;
}

export type Links = Record<string, Linked[]>;

export interface RecordRow {
  id: string;
  object: string;
  properties: Record<string, unknown>;
  owner_id: string | null;
  team_id: string | null;
  created_at: string;
  updated_at: string;
  /** Who it is linked to, by kind of record. Only on lists that ask for it. */
  associations?: Links;
}

export interface RecordsPage {
  results: RecordRow[];
  metadata: {
    page: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

/** What a form holds: text for every input, a boolean for a checkbox, and a list of ids for several members. */
export type FormValues = Record<string, string | boolean | string[]>;

/** Links are edited as links, not as a field of the form. */
export const editableFields = (fields: FieldDef[]) =>
  fields.filter((f) => !f.read_only && f.type !== 'LINK');

/** A user field's value as a list of member ids, whether it holds one or several. */
export const memberIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map(String)
    : value === undefined || value === null || value === ''
      ? []
      : [String(value)];

export function emptyValues(fields: FieldDef[]): FormValues {
  return Object.fromEntries(
    editableFields(fields).map((f) => [
      f.name,
      f.type === 'BOOLEAN' ? false : f.type === 'USER' && f.config.many ? [] : '',
    ]),
  );
}

/** Timestamps are edited as a date, so an ISO timestamp becomes YYYY-MM-DD. */
export function valuesFromRecord(
  fields: FieldDef[],
  properties: Record<string, unknown>,
): FormValues {
  return Object.fromEntries(
    editableFields(fields).map((f) => {
      const value = properties[f.name];
      if (f.type === 'BOOLEAN') return [f.name, value === true];
      if (f.type === 'USER' && f.config.many) return [f.name, memberIds(value)];
      if (value === undefined || value === null) return [f.name, ''];
      if (f.type === 'TIMESTAMP') return [f.name, String(value).slice(0, 10)];
      return [f.name, String(value)];
    }),
  );
}

/**
 * The properties to send. A blank optional field is left out when creating and cleared
 * (null) when updating, so emptying an input really removes the value.
 */
export function propertiesFromValues(
  fields: FieldDef[],
  values: FormValues,
  mode: 'create' | 'update',
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const field of editableFields(fields)) {
    const value = values[field.name];
    if (field.type === 'BOOLEAN') {
      properties[field.name] = value === true;
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length > 0) properties[field.name] = value;
      else if (mode === 'update') properties[field.name] = null;
      continue;
    }
    const text = typeof value === 'string' ? value.trim() : '';
    if (text === '') {
      if (mode === 'update') properties[field.name] = null;
      continue;
    }
    properties[field.name] = field.type === 'NUMBER' ? Number(text) : text;
  }
  return properties;
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

/** A value as shown in a table cell. */
export function formatValue(field: FieldDef, value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (field.type === 'BOOLEAN') return value === true ? 'Yes' : 'No';
  if (field.type === 'NUMBER')
    return typeof value === 'number' ? numberFormat.format(value) : String(value);
  if (field.type === 'TIMESTAMP') {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : dateFormat.format(date);
  }
  return String(value);
}

/** Text fields a search box can look through. */
export const searchableFields = (fields: FieldDef[]) =>
  fields.filter((f) => f.filterable && (f.type === 'TEXT' || f.type === 'EMAIL'));

export interface Sort {
  field: string;
  direction: 'asc' | 'desc';
}

/** The body for the filter endpoint: any searchable field containing the text. */
export function searchBody(
  fields: FieldDef[],
  text: string,
  page: number,
  pageSize: number,
  sort: Sort | null,
  filters: ColumnFilter[] = [],
) {
  // Groups are alternatives and a group's filters all apply, so the column filters go into every
  // group: a record must match the search text in one of its fields AND every filter.
  const columns = filters.map((f) => filterRequest(fields, f));
  const groups =
    text.trim() === ''
      ? [{ filters: columns }]
      : searchableFields(fields).map((f) => ({
          filters: [{ field_path: f.name, operator: 'CONTAINS', value: text }, ...columns],
        }));
  return {
    filter_groups: groups,
    pagination: { page, page_size: pageSize },
    ...(sort ? { sort: { field: sort.field, direction: sort.direction.toUpperCase() } } : {}),
  };
}

/** The columns a table shows: every field the person can read, in order. */
/** The fields shown as columns. Links are shown as the link columns, from the object's associations. */
export const columnsFor = (fields: FieldDef[]) =>
  fields.filter((f) => !f.sensitive && f.type !== 'LINK');

/** What a field type is called to the person adding one. */
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: 'Text',
  EMAIL: 'Email',
  NUMBER: 'Number',
  BOOLEAN: 'Yes / no',
  TIMESTAMP: 'Date',
  ENUM: 'Choice',
  LINK: 'Link',
  USER: 'User',
};

/** A field's key from its label: lowercase letters, digits and underscores, starting with a letter. */
export function keyFromLabel(label: string): string {
  const key = label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 63);
  return /^[a-z]/.test(key) || key === '' ? key : `f_${key}`.slice(0, 63);
}

export interface NewField {
  label: string;
  name: string;
  type: FieldType;
  required: boolean;
  unique: boolean;
  filterable: boolean;
  /** One choice per line; only for a choice field. */
  options: string;
  /** For a link: the object it points at. */
  target: string;
  /** For a link or user field: whether it holds many. */
  many: boolean;
}

/** The request body for adding a field. */
export function newFieldBody(field: NewField) {
  const options = field.options
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, all) => line !== '' && all.indexOf(line) === index);
  const link = field.type === 'LINK';
  const user = field.type === 'USER';
  return {
    name: field.name,
    label: field.label.trim(),
    type: field.type,
    // A link is never required, unique or searched; a list of members cannot be searched.
    required: link ? false : field.required,
    unique: link || user ? false : field.unique,
    filterable: link || (user && field.many) ? false : field.filterable,
    ...(field.type === 'ENUM' ? { config: { options } } : {}),
    ...(link ? { config: { target: field.target, many: field.many } } : {}),
    ...(user ? { config: { many: field.many } } : {}),
  };
}

/** What the edit form holds for an existing field. */
export interface FieldEdit {
  label: string;
  filterable: boolean;
  required: boolean;
  /** One choice per line; only for a choice field. */
  options: string;
  /** For a link or user field: whether it holds many. */
  many: boolean;
}

export const editFromField = (field: FieldDef): FieldEdit => ({
  label: field.label,
  filterable: field.filterable,
  required: field.required,
  options: (field.config.options ?? []).join('\n'),
  many: field.config.many === true,
});

const optionList = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, all) => line !== '' && all.indexOf(line) === index);

/** Only what changed, as the update request wants it. Empty when nothing did. */
export function fieldPatchBody(field: FieldDef, edit: FieldEdit) {
  const body: {
    label?: string;
    filterable?: boolean;
    required?: boolean;
    config?: { options?: string[]; many?: boolean };
  } = {};
  if (edit.label.trim() !== field.label) body.label = edit.label.trim();
  if (edit.filterable !== field.filterable) body.filterable = edit.filterable;
  if (edit.required !== field.required) body.required = edit.required;
  if (field.type === 'ENUM') {
    const options = optionList(edit.options);
    if (JSON.stringify(options) !== JSON.stringify(field.config.options ?? []))
      body.config = { options };
  }
  if (
    (field.type === 'LINK' || field.type === 'USER') &&
    edit.many !== (field.config.many === true)
  )
    body.config = { many: edit.many };
  return body;
}

/** What a record is called when shown as a link: a person by full name, anything else by its first field. */
export function recordLabel(
  def: Pick<ObjectDef, 'label' | 'fields'>,
  row: Pick<RecordRow, 'id' | 'properties'>,
): string {
  const text = (name: string) =>
    typeof row.properties[name] === 'string' ? (row.properties[name] as string).trim() : '';
  const person = def.fields.some((f) => f.name === 'first_name')
    ? [text('first_name'), text('last_name')].filter(Boolean).join(' ')
    : '';
  const first = def.fields[0] ? row.properties[def.fields[0].name] : undefined;
  return (
    person ||
    (first === undefined || first === null || first === '' ? '' : String(first)) ||
    `${def.label} ${row.id}`
  );
}

/** The ids of each kind of link, in the order the server wants them. */
export const linkIds = (links: Linked[] | undefined) => (links ?? []).map((l) => l.id);

/** Whether two lists link the same records, whatever the order. */
export const sameLinks = (a: Linked[] | undefined, b: Linked[] | undefined) => {
  const left = linkIds(a).sort();
  const right = linkIds(b).sort();
  return left.length === right.length && left.every((id, i) => id === right[i]);
};

export interface HistoryEntry {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  changes: Record<string, { old: unknown; new: unknown }>;
  actor_type: string;
  actor_id: string | null;
  created_at: string;
}

const shownValue = (
  field: FieldDef | undefined,
  value: unknown,
  people: Record<string, string> = {},
) => {
  if (value === null || value === undefined || value === '') return 'empty';
  if (field?.type === 'USER')
    return (
      memberIds(value)
        .map((id) => people[id] ?? id)
        .join(', ') || 'empty'
    );
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (field?.type === 'TIMESTAMP') return String(value).slice(0, 10);
  return String(value);
};

/** What one history entry says happened, a line per change, in words. */
export function describeHistory(
  def: Pick<ObjectDef, 'fields' | 'associations'>,
  entry: HistoryEntry,
  people: Record<string, string> = {},
): string[] {
  if (entry.action === 'CREATE') return ['Created'];
  if (entry.action === 'DELETE') return ['Deleted'];
  const lines: string[] = [];
  for (const [key, change] of Object.entries(entry.changes)) {
    if (key.startsWith('associations.')) {
      const kind = def.associations?.find((a) => a.name === key.slice('associations.'.length));
      const heading = kind?.label ?? key.slice('associations.'.length);
      // This record's own links are lists of ids; on the record at the other end it is that one id.
      const before = Array.isArray(change.old) ? change.old : change.old ? [change.old] : [];
      const after = Array.isArray(change.new) ? change.new : change.new ? [change.new] : [];
      const added = after.filter((id) => !before.includes(id)).length;
      const removed = before.filter((id) => !after.includes(id)).length;
      if (added > 0) lines.push(`${heading}: linked ${added}`);
      if (removed > 0) lines.push(`${heading}: unlinked ${removed}`);
      continue;
    }
    const field = def.fields.find((f) => f.name === key);
    lines.push(
      `${field?.label ?? key}: ${shownValue(field, change.old, people)} → ${shownValue(field, change.new, people)}`,
    );
  }
  return lines;
}

export type FilterOp =
  | 'IN'
  | 'CONTAINS'
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'IS_NULL'
  | 'IS_NOT_NULL';

/** One condition on one column: `stage is won`. The value is text, as typed or chosen. */
export interface ColumnFilter {
  field: string;
  op: FilterOp;
  value: string;
}

const multi: { op: FilterOp; label: string } = { op: 'IN', label: 'is any of' };

const empties: { op: FilterOp; label: string }[] = [
  { op: 'IS_NULL', label: 'is empty' },
  { op: 'IS_NOT_NULL', label: 'is not empty' },
];

/** What can be asked of each kind of field. */
export const FILTER_OPS: Record<FieldType, { op: FilterOp; label: string }[]> = {
  TEXT: [
    multi,
    { op: 'CONTAINS', label: 'contains' },
    { op: 'EQUALS', label: 'is' },
    { op: 'NOT_EQUALS', label: 'is not' },
    ...empties,
  ],
  EMAIL: [
    multi,
    { op: 'CONTAINS', label: 'contains' },
    { op: 'EQUALS', label: 'is' },
    { op: 'NOT_EQUALS', label: 'is not' },
    ...empties,
  ],
  NUMBER: [
    multi,
    { op: 'EQUALS', label: '=' },
    { op: 'NOT_EQUALS', label: '≠' },
    { op: 'GREATER_THAN', label: '>' },
    { op: 'LESS_THAN', label: '<' },
    ...empties,
  ],
  ENUM: [multi, { op: 'EQUALS', label: 'is' }, { op: 'NOT_EQUALS', label: 'is not' }, ...empties],
  BOOLEAN: [multi, { op: 'EQUALS', label: 'is' }],
  TIMESTAMP: [
    multi,
    { op: 'LESS_THAN', label: 'is before' },
    { op: 'GREATER_THAN', label: 'is after' },
    ...empties,
  ],
  USER: [multi, { op: 'EQUALS', label: 'is' }, { op: 'NOT_EQUALS', label: 'is not' }, ...empties],
  LINK: [],
};

export const needsValue = (op: FilterOp) => op !== 'IS_NULL' && op !== 'IS_NOT_NULL';

/** A filter as one URL parameter: `field~OP~value`. */
export const encodeFilter = (f: ColumnFilter) => `${f.field}~${f.op}~${f.value}`;

/** The filters a URL asks for. What cannot be honoured (unknown or unfilterable field, an operator that does not fit, a missing value) is left out. */
export function parseFilters(raw: string[], fields: FieldDef[]): ColumnFilter[] {
  const result: ColumnFilter[] = [];
  for (const item of raw) {
    const [field, op, ...rest] = item.split('~');
    const value = rest.join('~');
    const def = fields.find((f) => f.name === field);
    const allowed = def?.filterable ? FILTER_OPS[def.type]?.find((o) => o.op === op) : undefined;
    if (!def || !allowed) continue;
    if (allowed.op === 'IN') {
      try {
        const values: unknown = JSON.parse(value);
        if (
          !Array.isArray(values) ||
          values.length === 0 ||
          values.length > 1000 ||
          !values.every((entry) => entry === null || typeof entry === 'string')
        )
          continue;
        if (
          def.type === 'NUMBER' &&
          values.some(
            (entry) => entry !== null && (entry.trim() === '' || !Number.isFinite(Number(entry))),
          )
        )
          continue;
        if (
          def.type === 'BOOLEAN' &&
          values.some((entry) => entry !== null && entry !== 'true' && entry !== 'false')
        )
          continue;
        if (
          def.type === 'TIMESTAMP' &&
          values.some((entry) => entry !== null && Number.isNaN(Date.parse(entry)))
        )
          continue;
        if (
          def.type === 'USER' &&
          values.some((entry) => entry !== null && !/^[1-9]\d*$/.test(entry))
        )
          continue;
        result.push({ field, op: 'IN', value: JSON.stringify([...new Set(values)]) });
      } catch {
        /* Ignore malformed values in a shared URL. */
      }
      continue;
    }
    if (needsValue(allowed.op) && value === '') continue;
    if (def.type === 'NUMBER' && needsValue(allowed.op) && Number.isNaN(Number(value))) continue;
    if (def.type === 'BOOLEAN' && value !== 'true' && value !== 'false') continue;
    result.push({ field, op: allowed.op, value: needsValue(allowed.op) ? value : '' });
  }
  return result;
}

/** The API's filter for a column filter, with the value as the field's type wants it. */
export function filterRequest(fields: FieldDef[], f: ColumnFilter) {
  const type = fields.find((x) => x.name === f.field)?.type;
  if (f.op === 'IN')
    return {
      field_path: f.field,
      operator: 'IN',
      values: (JSON.parse(f.value) as (string | null)[]).map((value) =>
        value === null
          ? null
          : type === 'NUMBER'
            ? Number(value)
            : type === 'BOOLEAN'
              ? value === 'true'
              : value,
      ),
    };
  if (!needsValue(f.op)) return { field_path: f.field, operator: f.op };
  const value =
    type === 'NUMBER' ? Number(f.value) : type === 'BOOLEAN' ? f.value === 'true' : f.value;
  return { field_path: f.field, operator: f.op, value };
}

/** A filter in words: `Stage is won`. */
export function describeFilter(
  fields: FieldDef[],
  f: ColumnFilter,
  people: Record<string, string> = {},
): string {
  const def = fields.find((x) => x.name === f.field);
  const op = def ? FILTER_OPS[def.type].find((o) => o.op === f.op)?.label : f.op;
  if (f.op === 'IN') {
    const values = (JSON.parse(f.value) as (string | null)[]).map((value) =>
      value === null
        ? '(Blank)'
        : def?.type === 'BOOLEAN'
          ? value === 'true'
            ? 'yes'
            : 'no'
          : def?.type === 'USER'
            ? (people[value] ?? value)
            : value,
    );
    return `${def?.label ?? f.field} is any of ${values.join(', ')}`;
  }
  const value = needsValue(f.op)
    ? def?.type === 'BOOLEAN'
      ? f.value === 'true'
        ? 'yes'
        : 'no'
      : def?.type === 'USER'
        ? (people[f.value] ?? f.value)
        : f.value
    : '';
  return [def?.label ?? f.field, op, value].filter(Boolean).join(' ');
}

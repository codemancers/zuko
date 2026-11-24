import { describe, expect, it } from 'vitest';
import {
  headerFilterKind,
  headerValue,
  mergeHeaderFilters,
  toHeaderFilters,
} from './header-filters';
import type { FieldDef, ColumnFilter } from './records';

const field = (name: string, type: FieldDef['type'], extra: Partial<FieldDef> = {}): FieldDef => ({
  name,
  label: name,
  type,
  required: false,
  unique: false,
  filterable: true,
  read_only: false,
  sensitive: false,
  max_length: null,
  config: {},
  ...extra,
});
const fields = [
  field('name', 'TEXT'),
  field('amount', 'NUMBER'),
  field('active', 'BOOLEAN'),
  field('owner', 'USER'),
];

describe('sheet header filters', () => {
  it('offers filters only for fields supported by the backend', () => {
    expect(headerFilterKind(fields[0])).toBe('text');
    expect(headerFilterKind(fields[1])).toBe('values');
    for (const unsupported of [
      field('private', 'TEXT', { sensitive: true }),
      field('link', 'LINK'),
      field('users', 'USER', { config: { many: true } }),
      field('disabled', 'TEXT', { filterable: false }),
    ])
      expect(headerFilterKind(unsupported)).toBeUndefined();
  });

  it('preserves blank and boolean selections when translating between the URL and sheet', () => {
    const filters: ColumnFilter[] = [{ field: 'active', op: 'IN', value: '[null,"true"]' }];
    const previous = toHeaderFilters(fields, filters, []);
    expect(previous).toEqual([{ id: 'active', value: [null, 'Yes'] }]);
    expect(
      mergeHeaderFilters(
        fields,
        previous,
        [{ id: 'active', value: [null, 'No'] }],
        filters,
        { active: [{ value: 'false', count: 2 }] },
        [],
      ),
    ).toEqual([{ field: 'active', op: 'IN', value: '[null,"false"]' }]);
  });

  it('keeps advanced filters on untouched columns and replaces edited columns', () => {
    const filters: ColumnFilter[] = [
      { field: 'amount', op: 'GREATER_THAN', value: '10' },
      { field: 'name', op: 'CONTAINS', value: 'Ada' },
    ];
    expect(
      mergeHeaderFilters(
        fields,
        toHeaderFilters(fields, filters, []),
        [{ id: 'name', value: 'Grace' }],
        filters,
        {},
        [],
      ),
    ).toEqual([
      { field: 'amount', op: 'GREATER_THAN', value: '10' },
      { field: 'name', op: 'CONTAINS', value: 'Grace' },
    ]);
  });

  it('distinguishes members sharing a display name and retains selected values absent from facets', () => {
    const members = [
      { value: '1', label: 'Sam' },
      { value: '2', label: 'Sam' },
    ];
    expect(headerValue(fields[3], '1', members)).toBe('Sam (1)');
    const filters: ColumnFilter[] = [{ field: 'owner', op: 'IN', value: '["1","2"]' }];
    expect(
      mergeHeaderFilters(
        fields,
        toHeaderFilters(fields, filters, members),
        [{ id: 'owner', value: ['Sam (2)'] }],
        filters,
        {},
        members,
      ),
    ).toEqual([{ field: 'owner', op: 'IN', value: '["2"]' }]);
  });
});

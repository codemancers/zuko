import { describe, expect, it } from 'vitest';
import { CrmError } from './errors';
import type { FieldDef } from './field-types';
import { filterSql, orderSql, type FilterGroup } from './query';

const field = (over: Partial<FieldDef> & Pick<FieldDef, 'name' | 'type'>): FieldDef => ({
  required: false,
  isUnique: false,
  filterable: true,
  readOnly: false,
  sensitive: false,
  maxLength: null,
  config: {},
  ...over,
});

const fields = [
  field({ name: 'name', type: 'TEXT' }),
  field({ name: 'amount', type: 'NUMBER' }),
  field({ name: 'closed_at', type: 'TIMESTAMP' }),
  field({ name: 'hidden', type: 'TEXT', filterable: false }),
];

const group = (...filters: FilterGroup['filters']): FilterGroup[] => [{ logical_operator: 'AND', filters }];

function errorsOf(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    return (error as CrmError).errors.map((e) => `${e.field}:${e.code}`);
  }
  return [];
}

describe('filterSql', () => {
  it('matches everything with no filters', () => {
    expect(filterSql([], fields).sql).toBe('TRUE');
    expect(filterSql([{ logical_operator: 'AND', filters: [] }], fields).sql).toBe('TRUE');
  });

  it('binds property names and values instead of splicing them in', () => {
    const sql = filterSql(group({ field_path: 'amount', operator: 'GREATER_THAN', value: 100 }), fields);
    expect(sql.sql).toContain('->>');
    expect(sql.sql).not.toContain('amount');
    expect(sql.values).toContain('amount');
    expect(sql.values).toContain(100);
  });

  it('casts numbers and timestamps', () => {
    expect(filterSql(group({ field_path: 'amount', operator: 'EQUALS', value: 1 }), fields).sql).toContain('::numeric');
    expect(
      filterSql(group({ field_path: 'closed_at', operator: 'LESS_THAN', value: '2026-01-01' }), fields).values,
    ).toContain('2026-01-01T00:00:00.000Z');
  });

  it('escapes LIKE wildcards', () => {
    const sql = filterSql(group({ field_path: 'name', operator: 'CONTAINS', value: '50%_\\' }), fields);
    expect(sql.values).toContain('%50\\%\\_\\\\%');
  });

  it('ORs groups and uses each group operator inside', () => {
    const sql = filterSql(
      [
        { logical_operator: 'OR', filters: [{ field_path: 'name', operator: 'EQUALS', value: 'a' }, { field_path: 'name', operator: 'EQUALS', value: 'b' }] },
        { logical_operator: 'AND', filters: [{ field_path: 'amount', operator: 'IS_NULL' }] },
      ],
      fields,
    ).sql;
    expect(sql).toMatch(/\) OR \(/);
    expect(sql).toContain(' OR ');
  });

  it('only filters on filterable fields and known paths', () => {
    expect(errorsOf(() => filterSql(group({ field_path: 'hidden', operator: 'EQUALS', value: 'x' }), fields))).toEqual([
      'hidden:INVALID_FIELD',
    ]);
    expect(errorsOf(() => filterSql(group({ field_path: 'nope', operator: 'EQUALS', value: 'x' }), fields))).toEqual([
      'nope:INVALID_FIELD',
    ]);
  });

  it('allows system columns', () => {
    expect(() => filterSql(group({ field_path: 'created_at', operator: 'GREATER_THAN', value: '2026-01-01' }), fields)).not.toThrow();
    expect(() => filterSql(group({ field_path: 'owner_id', operator: 'EQUALS', value: '7' }), fields)).not.toThrow();
  });

  it('rejects operators that do not fit the field', () => {
    expect(errorsOf(() => filterSql(group({ field_path: 'name', operator: 'GREATER_THAN', value: 'a' }), fields))).toEqual(['name:INVALID_FIELD']);
    expect(errorsOf(() => filterSql(group({ field_path: 'amount', operator: 'CONTAINS', value: '1' }), fields))).toEqual(['amount:INVALID_FIELD']);
    expect(errorsOf(() => filterSql(group({ field_path: 'amount', operator: 'EQUALS', value: 'ten' }), fields))).toEqual(['amount:INVALID_FIELD']);
    expect(errorsOf(() => filterSql(group({ field_path: 'amount', operator: 'BETWEEN', values: [1] }), fields))).toEqual(['amount:INVALID_FIELD']);
    expect(errorsOf(() => filterSql(group({ field_path: 'amount', operator: 'IN', values: [] }), fields))).toEqual(['amount:INVALID_FIELD']);
  });
});

describe('orderSql', () => {
  it('defaults to newest first with id as tie-breaker', () => {
    const sql = orderSql(undefined, fields).sql;
    expect(sql).toContain('"created_at" DESC');
    expect(sql).toContain('r."id" DESC');
  });

  it('sorts by a filterable field', () => {
    expect(orderSql({ field: 'amount', direction: 'ASC' }, fields).sql).toContain('ASC NULLS LAST');
  });

  it('rejects fields that cannot be sorted', () => {
    expect(errorsOf(() => orderSql({ field: 'hidden', direction: 'ASC' }, fields))).toEqual(['hidden:INVALID_SORT_FIELD']);
    expect(errorsOf(() => orderSql({ field: 'nope', direction: 'ASC' }, fields))).toEqual(['nope:INVALID_SORT_FIELD']);
  });
});

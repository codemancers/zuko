import { describe, expect, it } from 'vitest';
import { validateProperties, type FieldDef } from './field-types';

const field = (over: Partial<FieldDef> & Pick<FieldDef, 'name' | 'type'>): FieldDef => ({
  required: false,
  isUnique: false,
  filterable: false,
  readOnly: false,
  sensitive: false,
  maxLength: null,
  config: {},
  ...over,
});

const fields: FieldDef[] = [
  field({ name: 'email', type: 'EMAIL', required: true, isUnique: true }),
  field({ name: 'name', type: 'TEXT', maxLength: 5 }),
  field({ name: 'amount', type: 'NUMBER' }),
  field({ name: 'active', type: 'BOOLEAN' }),
  field({ name: 'closed_at', type: 'TIMESTAMP' }),
  field({ name: 'stage', type: 'ENUM', config: { options: ['open', 'won'] } }),
  field({ name: 'source', type: 'TEXT', readOnly: true }),
];

const codes = (r: ReturnType<typeof validateProperties>) => r.errors.map((e) => `${e.field}:${e.code}`);

describe('validateProperties', () => {
  it('accepts valid values and normalizes timestamps', () => {
    const r = validateProperties(
      fields,
      { email: 'a@x.com', amount: 3.5, active: false, closed_at: '2026-11-01', stage: 'won' },
      'create',
    );
    expect(r.errors).toEqual([]);
    expect(r.set['closed_at']).toBe('2026-11-01T00:00:00.000Z');
    expect(r.set['active']).toBe(false);
  });

  it('requires required fields on create', () => {
    expect(codes(validateProperties(fields, {}, 'create'))).toEqual(['email:REQUIRED_FIELD_MISSING']);
  });

  it('does not require them on update', () => {
    expect(validateProperties(fields, { amount: 1 }, 'update').errors).toEqual([]);
  });

  it('rejects unknown fields, read-only fields and wrong types', () => {
    const r = validateProperties(
      fields,
      { email: 'not-an-email', amount: '5', active: 'yes', closed_at: 'soon', stage: 'lost', nope: 1, source: 'x' },
      'update',
    );
    expect(codes(r).sort()).toEqual(
      [
        'active:INVALID_FIELD',
        'amount:INVALID_FIELD',
        'closed_at:INVALID_FIELD',
        'email:INVALID_FIELD',
        'nope:UNKNOWN_FIELD',
        'source:INVALID_FIELD',
        'stage:INVALID_FIELD',
      ].sort(),
    );
  });

  it('enforces max length', () => {
    expect(codes(validateProperties(fields, { email: 'a@x.com', name: 'toolong' }, 'create'))).toEqual([
      'name:MAX_LENGTH_EXCEEDED',
    ]);
  });

  it('clears optional fields with null but not required ones', () => {
    const ok = validateProperties(fields, { amount: null }, 'update');
    expect(ok.clear).toEqual(['amount']);
    expect(codes(validateProperties(fields, { email: null }, 'update'))).toEqual(['email:REQUIRED_FIELD_MISSING']);
  });
});

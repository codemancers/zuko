import { describe, expect, it } from 'vitest';
import { FIELD_TYPES } from './field-types';
import { STANDARD_ASSOCIATIONS, STANDARD_OBJECTS } from './standard-objects';

const NAME = /^[a-z][a-z0-9_]{0,62}$/; // what the API accepts for object and field names

describe('STANDARD_OBJECTS', () => {
  it('are contact, company, deal, prospect and lead', () => {
    expect(STANDARD_OBJECTS.map((o) => o.slug)).toEqual(['contact', 'company', 'deal', 'prospect', 'lead']);
  });

  it.each(STANDARD_OBJECTS.map((o) => [o.slug, o] as const))('%s only uses names and types the API accepts', (_slug, object) => {
    expect(object.slug).toMatch(NAME);
    const names = object.fields.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((name) => NAME.test(name))).toBe(true);
    expect(object.fields.every((f) => (FIELD_TYPES as readonly string[]).includes(f.type))).toBe(true);
  });

  it.each(STANDARD_OBJECTS.map((o) => [o.slug, o.fields] as const))('%s describes its field options and limits consistently', (_slug, fields) => {
    const enums = fields.filter((f) => f.type === 'ENUM');
    const others = fields.filter((f) => f.type !== 'ENUM');
    expect(enums.every((f) => (f.options?.length ?? 0) > 0)).toBe(true);
    expect(others.every((f) => f.options === undefined)).toBe(true);
    // Unique values and lengths are compared as text.
    const textLike = (f: { type: string }) => f.type === 'TEXT' || f.type === 'EMAIL';
    expect(fields.filter((f) => f.unique).every(textLike)).toBe(true);
    expect(fields.filter((f) => f.maxLength !== undefined).every(textLike)).toBe(true);
  });

  it('only link objects that exist, with a unique link per source field', () => {
    const slugs = new Set(STANDARD_OBJECTS.map((o) => o.slug));
    const keys = STANDARD_ASSOCIATIONS.map((a) => `${a.source}.${a.field}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(STANDARD_ASSOCIATIONS.map((a) => a.name)).size).toBe(STANDARD_ASSOCIATIONS.length);
    for (const a of STANDARD_ASSOCIATIONS) {
      expect(slugs.has(a.source) && slugs.has(a.target)).toBe(true);
      const source = STANDARD_OBJECTS.find((o) => o.slug === a.source)!;
      expect(source.fields.some((f) => f.name === a.field)).toBe(false); // the link is the field
    }
  });

  it('leaves the conversion links single-valued', () => {
    const single = STANDARD_ASSOCIATIONS.filter((a) => a.many === false).map((a) => a.name);
    expect(single).toEqual(['prospect_lead', 'lead_contact']);
  });

  it('gives every object something to call a record by', () => {
    for (const object of STANDARD_OBJECTS) {
      expect(object.fields.some((f) => f.required)).toBe(true);
    }
  });
});

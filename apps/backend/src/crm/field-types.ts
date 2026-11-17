import type { FieldError } from './errors';

export const FIELD_TYPES = ['TEXT', 'EMAIL', 'NUMBER', 'BOOLEAN', 'TIMESTAMP', 'ENUM'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface FieldDef {
  name: string;
  type: string;
  required: boolean;
  isUnique: boolean;
  filterable: boolean;
  readOnly: boolean;
  sensitive: boolean;
  maxLength: number | null;
  config: unknown;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const enumOptions = (field: Pick<FieldDef, 'config'>): string[] => {
  const options = (field.config as { options?: unknown } | null)?.options;
  return Array.isArray(options) ? options.filter((o): o is string => typeof o === 'string') : [];
};

/** Check one value against its field. Returns the normalized value, or an error. */
function checkValue(field: FieldDef, value: unknown): { value: unknown } | { error: FieldError } {
  const fail = (code: string, message: string) => ({ error: { field: field.name, code, message } });
  switch (field.type) {
    case 'TEXT':
    case 'EMAIL':
      if (typeof value !== 'string') {
        return fail('INVALID_FIELD', `Field '${field.name}' must be text`);
      }
      if (field.type === 'EMAIL' && !EMAIL.test(value)) {
        return fail('INVALID_FIELD', `Field '${field.name}' must be a valid email address`);
      }
      if (field.maxLength !== null && value.length > field.maxLength) {
        return fail('MAX_LENGTH_EXCEEDED', `Field '${field.name}' must be at most ${field.maxLength} characters`);
      }
      return { value };
    case 'NUMBER':
      return typeof value === 'number' && Number.isFinite(value)
        ? { value }
        : fail('INVALID_FIELD', `Field '${field.name}' must be a number`);
    case 'BOOLEAN':
      return typeof value === 'boolean' ? { value } : fail('INVALID_FIELD', `Field '${field.name}' must be true or false`);
    case 'TIMESTAMP': {
      const time = typeof value === 'string' ? new Date(value) : null;
      return time && !Number.isNaN(time.getTime())
        ? { value: time.toISOString() }
        : fail('INVALID_FIELD', `Field '${field.name}' must be an ISO 8601 timestamp`);
    }
    case 'ENUM':
      return typeof value === 'string' && enumOptions(field).includes(value)
        ? { value }
        : fail('INVALID_FIELD', `Field '${field.name}' must be one of: ${enumOptions(field).join(', ')}`);
    default:
      return fail('INVALID_FIELD', `Field '${field.name}' has an unsupported type`);
  }
}

/**
 * Validate the properties of a create or update against the object's fields.
 * `null` clears an optional field on update. Returns the normalized values to set
 * and the names to clear.
 */
export function validateProperties(
  fields: readonly FieldDef[],
  input: Record<string, unknown>,
  mode: 'create' | 'update',
): { set: Record<string, unknown>; clear: string[]; errors: FieldError[] } {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const set: Record<string, unknown> = {};
  const clear: string[] = [];
  const errors: FieldError[] = [];

  for (const [name, raw] of Object.entries(input)) {
    const field = byName.get(name);
    if (!field) {
      errors.push({ field: name, code: 'UNKNOWN_FIELD', message: `Field '${name}' does not exist on this object` });
      continue;
    }
    if (field.readOnly) {
      errors.push({ field: name, code: 'INVALID_FIELD', message: `Field '${name}' is read-only` });
      continue;
    }
    if (raw === null) {
      if (field.required) {
        errors.push({ field: name, code: 'REQUIRED_FIELD_MISSING', message: `Field '${name}' is required` });
      } else {
        clear.push(name);
      }
      continue;
    }
    const checked = checkValue(field, raw);
    if ('error' in checked) {
      errors.push(checked.error);
    } else {
      set[name] = checked.value;
    }
  }

  if (mode === 'create') {
    for (const field of fields) {
      if (field.required && !field.readOnly && set[field.name] === undefined && !errors.some((e) => e.field === field.name)) {
        errors.push({ field: field.name, code: 'REQUIRED_FIELD_MISSING', message: `Field '${field.name}' is required` });
      }
    }
  }
  return { set, clear, errors };
}

import dayjs from 'dayjs';
import { ColumnType } from '../types/table-metadata';

/**
 * Normalizes a raw value based on its ColumnType (e.g., handles date/number casting)
 */
export function castCustomFieldValue(value: unknown, fieldType: ColumnType): unknown {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  switch (fieldType) {
    case 'number':
    case 'currency':
      return isNaN(Number(value)) ? null : Number(value);
    case 'date': {
      const date = dayjs(value as string);
      return date.isValid() ? date.toISOString() : null;
    }
    case 'select':
    case 'text':
    default:
      return value;
  }
}

/**
 * Takes existing JSON fields and updates a specific key with a normalized value.
 * Handles deletions if the value is empty.
 */
export function mergeCustomFieldValue(
  existingFields: Record<string, unknown> | null | undefined,
  columnId: string,
  value: unknown,
  fieldType: ColumnType,
): Record<string, unknown> {
  const fields = { ...(existingFields || {}) } as Record<string, unknown>;
  const isEmpty =
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '');

  if (isEmpty) {
    delete fields[columnId];
  } else {
    fields[columnId] = castCustomFieldValue(value, fieldType);
  }

  return fields;
}

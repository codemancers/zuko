import { BadRequestException } from '@nestjs/common';
import dayjs from 'dayjs';
import type { ColumnConfig, ColumnType } from '../types/table-metadata';

/**
 * Normalizes a raw value based on its ColumnType (e.g., handles date/number casting)
 * Custom field values are stored in json format. This method will ensure the data is stored in the correct data type format.
 */
export function castFieldValue(value: unknown, fieldType: ColumnType): unknown {
  if (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  ) {
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
 * Takes existing custom column values (stored in JSON fields) and updates a specific key with a normalized value.
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
    fields[columnId] = castFieldValue(value, fieldType);
  }

  return fields;
}

/**
 * Validates a value against its field type and configuration before updating the custom column cell value.
 * Throws BadRequestException if validation fails.
 */
export function validateCellValue(
  value: unknown,
  fieldType: ColumnType,
  config?: ColumnConfig,
): void {
  if (value === null || value === undefined || value === '') {
    return;
  }

  switch (fieldType) {
    case 'select': {
      // validate if update value is from the select-options
      const options = config?.options;
      if (Array.isArray(options)) {
        const isValid = options.some(
          (opt: { value: string }) => opt.value === value,
        );
        if (!isValid) {
          throw new BadRequestException(
            `Invalid option "${value}" for select field`,
          );
        }
      }
      break;
    }
    case 'number': {
      if (isNaN(Number(value))) {
        throw new BadRequestException(
          `Invalid number "${value}" for number field`,
        );
      }
      break;
    }
    case 'currency': {
      if (isNaN(Number(value))) {
        throw new BadRequestException(
          `Invalid currency "${value}" for currency field`,
        );
      }
      break;
    }
    case 'date': {
      const date = dayjs(value as string);
      if (!date.isValid()) {
        throw new BadRequestException(`Invalid date "${value}" for date field`);
      }
      break;
    }
    // Future expansion:
    // case 'multiselect': ...
  }
}

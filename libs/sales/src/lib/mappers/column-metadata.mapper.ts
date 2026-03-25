import { JsonValue } from '@prisma/client/runtime/client';
import {
  ColumnMetadata,
  ColumnType,
  DataType,
  ColumnConfig,
} from '../types/table-metadata';

/**
 * Represents a TableColumn record from the database.
 * Kept as an interface to avoid coupling to the Prisma-generated type.
 */
export interface TableColumnRecord {
  id: number;
  columnKey: string;
  label: string;
  fieldType: string;
  isRequired: boolean;
  config: JsonValue;
}

/**
 * Maps a fieldType to its corresponding storage DataType.
 */
const FIELD_TYPE_TO_DATA_TYPE: Record<string, DataType> = {
  text: 'text',
  number: 'number',
  date: 'date',
  currency: 'number',
  select: 'text',
  multiselect: 'json',
  relation: 'json',
  entity: 'text',
};

/**
 * Injects sensible default config values based on fieldType
 * so custom columns get proper formatting out of the box.
 */
function buildConfig(
  fieldType: string,
  userConfig: JsonValue,
): ColumnConfig {
  const config = { ...((userConfig as Record<string, unknown>) ?? {}) } as ColumnConfig;

  switch (fieldType) {
    case 'date':
      if (!config.format) config.format = 'date';
      break;
    case 'currency':
      if (!config.format) config.format = 'currency';
      if (!config.currency) config.currency = 'USD';
      break;
  }

  return config as ColumnConfig;
}

/**
 * Converts a single DB TableColumn record into a ColumnMetadata object.
 * All action fields (sortable, filterable, searchable, editable) are enabled.
 */
export function mapTableColumnToMetadata(
  column: TableColumnRecord,
): ColumnMetadata {
  return {
    id: column.columnKey,
    header: column.label,
    fieldType: (column.fieldType as ColumnType) || 'text',
    dataType: FIELD_TYPE_TO_DATA_TYPE[column.fieldType] || 'text',
    sortable: true,
    filterable: true,
    searchable: true,
    editable: true,
    isVisible: true,
    default: false,
    isRequired: column.isRequired,
    config: buildConfig(column.fieldType, column.config),
  };
}

/**
 * Converts an array of DB TableColumn records into ColumnMetadata[].
 */
export function mapTableColumnsToMetadata(
  columns: TableColumnRecord[],
): ColumnMetadata[] {
  return columns.map(mapTableColumnToMetadata);
}

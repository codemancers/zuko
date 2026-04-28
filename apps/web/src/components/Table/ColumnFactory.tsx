import type { ColumnDef } from '@tanstack/react-table';
import type { ColumnMetadata, CellValue, BaseRow } from './types';
import { DataField } from './TableFields';

/**
 * Type guard to check if a value is a CellValue object containing raw value and display text.
 * Used for handling API responses where a field might be decomposed into { value, display }.
 */
function isCellValue(data: unknown): data is CellValue<unknown> {
  return (
    typeof data === 'object' &&
    data !== null &&
    !Array.isArray(data) &&
    ('value' in data || 'display' in data)
  );
}

/**
 * Factory function to create TanStack Table column definitions from metadata.
 * Standardizes cell rendering and value decomposition.
 */
export function createColumnsFromMetadata<TData extends BaseRow>(
  metadata: ColumnMetadata[]
): ColumnDef<TData, unknown>[] {
  return metadata.map((col) => ({
    id: col.id,
    accessorKey: col.config?.accessorKey || col.id,
    header: col.header,
    meta: { metadata: col },
    cell: (info) => {
      const { row, getValue } = info;
      const data = getValue();
      
      let value: unknown = data;
      let display: string | undefined = undefined;

      // Handle decomposed values (standard for our API responses)
      if (isCellValue(data)) {
        value = data.value;
        display = data.display ?? undefined;
      }
      
      return (
        <DataField 
          value={value} 
          display={display}
          metadata={col} 
          row={row.original} 
        />
      );
    },
    enableSorting: col.sortable !== false,
  } as ColumnDef<TData, unknown>));
}

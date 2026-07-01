import type { Row } from '@tanstack/react-table';
import { BaseTableCell } from './BaseTableCell';
import { TableRow, TableCell } from '@zuko/ui-kit';
import clsx from 'clsx';
import type { BaseRow } from './types';

interface BaseTableRowProps<TData extends BaseRow> {
  row: Row<TData>;
  showAddColumn?: boolean;
  onCellUpdate?: (rowId: string | number, columnId: string, value: any) => void;
  disableRowClick?: boolean;
  onRowClick?: (row: TData) => void;
}

export function BaseTableRow<TData extends BaseRow>({
  row,
  showAddColumn,
  onCellUpdate,
  disableRowClick = false,
  onRowClick,
}: BaseTableRowProps<TData>) {
  return (
    <TableRow
      className={clsx(
        'group transition-all duration-200 ease-in hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
        !disableRowClick && onRowClick && 'hover:cursor-pointer',
      )}
      onClick={() => !disableRowClick && onRowClick?.(row.original)}
    >
      {row.getVisibleCells().map((cell) => (
        <BaseTableCell key={cell.id} cell={cell} onCellUpdate={onCellUpdate} />
      ))}
      {showAddColumn && <TableCell className="w-10" />}
    </TableRow>
  );
}

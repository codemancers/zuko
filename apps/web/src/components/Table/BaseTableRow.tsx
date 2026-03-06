import { Row } from '@tanstack/react-table';
import { BaseTableCell } from './BaseTableCell';
import { TableRow } from '@zuko/ui-kit';
import clsx from 'clsx';

interface BaseTableRowProps<TData> {
  row: Row<TData>;
  onRowClick?: (row: TData) => void;
}

export function BaseTableRow<TData>({ row, onRowClick }: BaseTableRowProps<TData>) {
  return (
    <TableRow
      className={clsx(
        'transition-all duration-200 ease-in hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
        onRowClick && 'hover:cursor-pointer'
      )}
      onClick={() => onRowClick?.(row.original)}
    >
      {row.getVisibleCells().map((cell) => (
        <BaseTableCell key={cell.id} cell={cell} />
      ))}
    </TableRow>
  );
}

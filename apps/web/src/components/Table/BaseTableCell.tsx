import { Cell, flexRender } from '@tanstack/react-table';
import { TableCell } from '@zuko/ui-kit';

interface BaseTableCellProps<TData> {
  cell: Cell<TData, any>;
}

export function BaseTableCell<TData>({ cell }: BaseTableCellProps<TData>) {
  return (
    <TableCell className="align-middle">
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </TableCell>
  );
}

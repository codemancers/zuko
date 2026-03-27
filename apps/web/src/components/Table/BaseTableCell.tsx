import { Cell, flexRender } from '@tanstack/react-table';
import { TableCell } from '@zuko/ui-kit';

interface BaseTableCellProps<TData> {
  cell: Cell<TData, any>;
  onCellUpdate?: (rowId: string | number, columnId: string, value: unknown) => void;
}

export function BaseTableCell<TData>({ cell, onCellUpdate }: BaseTableCellProps<TData>) {
  return (
    <TableCell 
      className="align-middle"
      style={{ 
        width: cell.column.id === 'sno' ? cell.column.getSize() : undefined,
        minWidth: cell.column.id === 'sno' ? cell.column.getSize() : cell.column.columnDef.minSize,
        maxWidth: cell.column.id === 'sno' ? cell.column.getSize() : cell.column.columnDef.maxSize,
      }}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </TableCell>
  );
}

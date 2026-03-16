import { RowModel } from '@tanstack/react-table';
import { BaseTableRow } from './BaseTableRow';
import { TableBody } from '@zuko/ui-kit';

interface BaseTableBodyProps<TData> {
  rowModel: RowModel<TData>;
  onRowClick?: (row: TData) => void;
  showAddColumn?: boolean;
}

export function BaseTableBody<TData>({ 
  rowModel, 
  onRowClick,
  showAddColumn 
}: BaseTableBodyProps<TData>) {
  return (
    <TableBody>
      {rowModel.rows.map((row) => (
        <BaseTableRow 
          key={row.id} 
          row={row} 
          onRowClick={onRowClick} 
          showAddColumn={showAddColumn}
        />
      ))}
    </TableBody>
  );
}

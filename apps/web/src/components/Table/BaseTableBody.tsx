import React from 'react';
import { RowModel } from '@tanstack/react-table';
import { BaseTableRow } from './BaseTableRow';
import { TableBody } from '@zuko/ui-kit';
import { BaseRow } from './types';

interface BaseTableBodyProps<TData extends BaseRow> {
  rowModel: RowModel<TData>;
  disableRowClick?: boolean;
  onRowClick?: (row: TData) => void;
  showAddColumn?: boolean;
  onCellUpdate?: (rowId: string | number, columnId: string, value: any) => void;
  addRowContent?: React.ReactNode;
}

export function BaseTableBody<TData extends BaseRow>({
  rowModel,
  disableRowClick = false,
  onRowClick,
  showAddColumn,
  onCellUpdate,
  addRowContent,
}: BaseTableBodyProps<TData>) {
  return (
    <TableBody>
      {rowModel.rows.map((row) => (
        <BaseTableRow<TData>
          key={row.id}
          row={row}
          disableRowClick={disableRowClick}
          onRowClick={onRowClick}
          showAddColumn={showAddColumn}
          onCellUpdate={onCellUpdate}
        />
      ))}
      {addRowContent}
    </TableBody>
  );
}

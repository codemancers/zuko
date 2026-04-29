import React from 'react';
import type { ColumnConfig } from '@/types/table-metadata';
import type {
  ColumnDef,
  PaginationState,
  SortingState,
  ColumnFiltersState,
  RowSelectionState,
  VisibilityState,
  OnChangeFn,
  Row,
} from '@tanstack/react-table';

export type {
  ColumnType,
  ColumnMetadata,
  TableViewResponse,
  CellValue,
} from '@/types/table-metadata';

export interface BaseRow {
  id: string | number;
}

export interface BaseTableProps<TData extends BaseRow> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  loading?: boolean;
  className?: string;
  disableRowClick?: boolean;

  // Pagination
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  pageCount?: number; // Needed for server-side pagination

  // Sorting
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;

  // Filtering
  filters?: ColumnFiltersState;
  onFiltersChange?: OnChangeFn<ColumnFiltersState>;

  // Selection
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;

  // Visibility
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;

  // Server-side flag
  manualPagination?: boolean;
  manualSorting?: boolean;
  manualFiltering?: boolean;

  // Additional features
  enableRowSelection?: boolean | ((row: Row<TData>) => boolean);
  onRowClick?: (row: TData) => void;
  renderEmptyState?: () => React.ReactNode;
  totalCount?: number;
  entityName?: string; // e.g. 'contacts', 'deals'
  showAddRow?: boolean;
  onAddRow?: () => void;
  addRowContent?: React.ReactNode;
  showAddColumn?: boolean;
  onAddColumn?: (
    name: string,
    key: string,
    type: string,
    config?: ColumnConfig,
  ) => void;
  openAddColumnRef?: React.MutableRefObject<(() => void) | undefined>;
  onCellUpdate?: (rowId: string | number, columnId: string, value: any) => void;
  showEmptyState?: boolean;
  emptyStateConfig?: {
    icon: React.ElementType;
    title: string;
    description: string;
    action: {
      label: string;
      onClick: () => void;
    };
  };
}

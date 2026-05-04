'use client';

import React from 'react';
import { useSheetState } from './use-sheet-state';
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from '@tanstack/react-table';
import type { BaseTableProps, BaseRow } from '@/components/Table/types';

export function useBaseTable<TData extends BaseRow>({
  columns,
  data,
  pagination,
  onPaginationChange,
  pageCount,
  sorting,
  onSortingChange,
  filters,
  onFiltersChange,
  rowSelection,
  onRowSelectionChange,
  columnVisibility,
  onColumnVisibilityChange,
  columnOrder,
  onColumnOrderChange,
  manualPagination,
  manualSorting,
  manualFiltering,
  enableRowSelection,
}: BaseTableProps<TData>) {
  const tableColumns = React.useMemo(() => {
    const snoColumn = {
      id: 'sno',
      header: 'S.No',
      cell: (info: any) => {
        const pageIndex = pagination?.pageIndex ?? 0;
        const pageSize = pagination?.pageSize ?? 10;
        return pageIndex * pageSize + info.row.index + 1;
      },
      size: 64,
      enableSorting: false,
      enableHiding: false,
      meta: {
        metadata: { pinned: true },
      },
    };
    return [snoColumn, ...columns];
  }, [columns, pagination]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    pageCount: pageCount,
    state: {
      pagination: pagination ?? { pageIndex: 0, pageSize: 10 },
      sorting: sorting ?? [],
      columnFilters: filters ?? [],
      rowSelection: rowSelection ?? {},
      columnVisibility: columnVisibility ?? {},
      ...(columnOrder?.length ? { columnOrder } : {}),
    },
    onPaginationChange,
    onSortingChange,
    onColumnFiltersChange: onFiltersChange,
    onRowSelectionChange,
    onColumnVisibilityChange,
    onColumnOrderChange,
    // Core Models
    getCoreRowModel: getCoreRowModel(),

    // Feature Models
    getPaginationRowModel: manualPagination
      ? undefined
      : getPaginationRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getFilteredRowModel: manualFiltering ? undefined : getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),

    // Manual/Server-side flags
    manualPagination,
    manualSorting,
    manualFiltering,

    autoResetPageIndex: false,

    // Selection
    enableRowSelection,
  });

  const [isAddColumnDialogOpen, setIsAddColumnDialogOpen] =
    useSheetState('addField');
  const openAddColumnDialog = React.useCallback(
    () => setIsAddColumnDialogOpen(true),
    [setIsAddColumnDialogOpen],
  );
  const closeAddColumnDialog = React.useCallback(
    () => setIsAddColumnDialogOpen(false),
    [setIsAddColumnDialogOpen],
  );

  return {
    table,
    isAddColumnDialogOpen,
    openAddColumnDialog,
    closeAddColumnDialog,
  };
}

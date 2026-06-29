'use client';

import React from 'react';
import { useSheetState } from './use-sheet-state';
import { useColumnOrder } from './use-column-order';
import { authClient } from '@/lib/auth-client';
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
  functionalUpdate,
} from '@tanstack/react-table';
import type { Updater, ColumnDef } from '@tanstack/react-table';
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
  columnOrder: externalColumnOrder,
  onColumnOrderChange: externalOnColumnOrderChange,
  columnReordering,
  manualPagination,
  manualSorting,
  manualFiltering,
  enableRowSelection,
  serialColumnHeader,
}: BaseTableProps<TData>) {
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const userId = session?.user?.id ?? '';

  const tableColumns = React.useMemo(() => {
    const snoColumn = {
      id: 'sno',
      header: serialColumnHeader ?? 'S.No',
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

  const [internalColumnOrder, setColumnOrder, pinnedColumnIds] = useColumnOrder(
    userId,
    columnReordering?.storageKey ?? '',
    columnReordering ? (tableColumns as ColumnDef<BaseRow, unknown>[]) : [],
  );

  const isColumnOrderReady = columnReordering
    ? !isSessionPending && internalColumnOrder.length > 0
    : true;

  const columnOrder = columnReordering
    ? internalColumnOrder.length
      ? internalColumnOrder
      : undefined
    : externalColumnOrder?.length
      ? externalColumnOrder
      : undefined;

  const onColumnOrderChange = columnReordering
    ? (updater: Updater<string[]>) =>
        setColumnOrder(functionalUpdate(updater, internalColumnOrder))
    : externalOnColumnOrderChange;

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
      ...(columnOrder ? { columnOrder } : {}),
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
    setColumnOrder,
    pinnedColumnIds,
    isColumnOrderReady,
  };
}

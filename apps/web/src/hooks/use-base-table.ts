import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from '@tanstack/react-table';
import { BaseTableProps } from '@/components/Table/types';

export function useBaseTable<TData>({
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
  manualPagination,
  manualSorting,
  manualFiltering,
  enableRowSelection,
}: BaseTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    pageCount: pageCount,
    state: {
      pagination: pagination ?? { pageIndex: 0, pageSize: 10 },
      sorting: sorting ?? [],
      columnFilters: filters ?? [],
      rowSelection: rowSelection ?? {},
      columnVisibility: columnVisibility ?? {},
    },
    onPaginationChange,
    onSortingChange,
    onColumnFiltersChange: onFiltersChange,
    onRowSelectionChange,
    onColumnVisibilityChange,
    
    // Core Models
    getCoreRowModel: getCoreRowModel(),
    
    // Feature Models
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getFilteredRowModel: manualFiltering ? undefined : getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    
    // Manual/Server-side flags
    manualPagination,
    manualSorting,
    manualFiltering,
    
    // Selection
    enableRowSelection,
  });

  return { table };
}

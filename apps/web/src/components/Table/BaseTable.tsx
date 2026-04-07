'use client';

import { useState, useEffect } from 'react';
import { useBaseTable } from '@/hooks/use-base-table';
import { BaseTableProps, BaseRow } from './types';
import { BaseTableHeader } from './BaseTableHeader';
import { BaseTableBody } from './BaseTableBody';
import { Table, Button } from '@zuko/ui-kit';
import { PlusIcon } from '@heroicons/react/24/outline';
import type { PaginationState } from '@tanstack/react-table';
import { AddColumnDialog } from './AddColumnDialog';
import React from 'react';
import { ColumnConfig } from '@/types/table-metadata';

const ChevronLeftIcon = '/icons/chevron-left.svg';
const ChevronRightIcon = '/icons/chevron-right.svg';

export function BaseTable<TData extends BaseRow>(props: BaseTableProps<TData>) {
  const [internalPagination, setInternalPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const effectiveProps = {
    ...props,
    pagination: props.pagination ?? internalPagination,
    onPaginationChange: props.onPaginationChange ?? setInternalPagination,
  };

  const {
    table,
    isAddColumnDialogOpen,
    openAddColumnDialog,
    closeAddColumnDialog
  } = useBaseTable(effectiveProps);

  const {
    loading,
    className,
    disableRowClick,
    onRowClick,
    showAddRow,
    onAddRow,
    addRowContent,
    showAddColumn,
    onAddColumn,
    onCellUpdate,
    showEmptyState: _showEmptyState,
    emptyStateConfig
  } = props;
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null; // Or a skeleton/placeholder
  }

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center mt-8 ${className ?? ''}`}>
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Loading {props.entityName ?? 'data'}...
        </div>
      </div>
    );
  }

  return (
    <div className={`mt-8 ${className ?? ''}`}>
      <div className="flow-root overflow-hidden border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm bg-white dark:bg-zinc-950">
        <Table grid dense className="[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)] text-sm">
          <BaseTableHeader<TData>
            headerGroups={table.getHeaderGroups()}
            showAddColumn={showAddColumn}
            onAddColumn={openAddColumnDialog}
          />
          <BaseTableBody<TData>
            rowModel={table.getRowModel()}
            disableRowClick={disableRowClick}
            onRowClick={onRowClick}
            showAddColumn={showAddColumn}
            onCellUpdate={onCellUpdate}
            addRowContent={addRowContent}
          />
        </Table>

        {showAddRow && (
          <div className="pl-2 py-1 h-10 border-zinc-200 dark:border-zinc-800 flex items-center bg-zinc-50/50 dark:bg-zinc-900/50">
            <Button
              plain
              onClick={onAddRow}
              aria-label="Add row"
              className="flex h-8 w-8 items-center justify-center !bg-transparent !border-none hover:!bg-transparent focus:!ring-0 shadow-none"
            >
              <PlusIcon className="h-4 w-4 text-zinc-400 cursor-pointer" />
            </Button>
          </div>
        )}
      </div>

      <AddColumnDialog
        isOpen={isAddColumnDialogOpen}
        onClose={closeAddColumnDialog}
        onAdd={(name: string, key: string, type: string, config?: ColumnConfig) => {
          onAddColumn?.(name, key, type, config);
        }}
      />

      {/* Pagination & Summary Footer */}
      {(props.totalCount !== undefined || (!props.manualPagination && (table.getCanNextPage() || table.getCanPreviousPage()))) && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex-1 flex justify-between sm:hidden">
            <Button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="relative inline-flex items-center px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-sm font-medium rounded-md text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              Previous
            </Button>
            <Button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-sm font-medium rounded-md text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              Next
            </Button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              {props.totalCount !== undefined ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Showing {props.data.length} of {props.totalCount} {props.entityName ?? 'results'}
                </p>
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
                </p>
              )}
            </div>
            {(table.getCanNextPage() || table.getCanPreviousPage()) && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-zinc-500 dark:text-zinc-500 mr-2 flex items-center">
                  Rows per page:
                  <select
                    value={table.getState().pagination.pageSize}
                    onChange={e => table.setPageSize(Number(e.target.value))}
                    className="ml-2 bg-transparent border-none text-zinc-700 dark:text-zinc-300 font-medium focus:ring-0 cursor-pointer text-sm"
                  >
                    {[10, 20, 30, 40, 50].map(pageSize => (
                      <option key={pageSize} value={pageSize} className="dark:bg-zinc-900">
                        {pageSize}
                      </option>
                    ))}
                  </select>
                </span>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <Button
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    className="relative inline-flex items-center px-3 py-2 rounded-l-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                  >
                    <span className="sr-only">Previous</span>
                    <img src={ChevronLeftIcon} className="h-5 w-5" alt="Previous" />
                  </Button>
                  <Button
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    className="relative inline-flex items-center px-3 py-2 rounded-r-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                  >
                    <span className="sr-only">Next</span>
                    <img src={ChevronRightIcon} className="h-5 w-5" alt="Next" />
                  </Button>
                </nav>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

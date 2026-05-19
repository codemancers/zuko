'use client';

import Image from 'next/image';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBaseTable } from '@/hooks/use-base-table';
import type { BaseTableProps, BaseRow } from './types';
import { BaseTableHeader } from './BaseTableHeader';
import { BaseTableBody } from './BaseTableBody';
import { BaseTableRow } from './BaseTableRow';
import { Table, Button, TableBody } from '@zuko/ui-kit';
import clsx from 'clsx';
import { PlusIcon } from '@heroicons/react/24/outline';
import type { PaginationState } from '@tanstack/react-table';
import { AddColumnDialog } from './AddColumnDialog';
import type { ColumnConfig } from '@/types/table-metadata';
import { useVirtualizer } from '@tanstack/react-virtual';

const CHEVRON_LEFT = '/icons/chevron-left.svg';
const CHEVRON_RIGHT = '/icons/chevron-right.svg';

export function BaseTable<TData extends BaseRow>(props: BaseTableProps<TData>) {
  const [internalPagination, setInternalPagination] =
    React.useState<PaginationState>({
      pageIndex: 0,
      pageSize: 10,
    });

  const isInfiniteScrollMode = props.onFetchNextPage !== undefined;

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const effectiveProps = {
    ...props,
    pagination: props.pagination ?? internalPagination,
    onPaginationChange: props.onPaginationChange ?? setInternalPagination,
    manualPagination: isInfiniteScrollMode ? true : props.manualPagination,
  };

  const {
    table,
    isAddColumnDialogOpen,
    openAddColumnDialog,
    closeAddColumnDialog,
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
    showEmptyState,
    emptyStateConfig,
    openAddColumnRef,
    isFetchingNextPage,
    hasNextPage,
  } = props;

  if (openAddColumnRef) {
    openAddColumnRef.current = openAddColumnDialog;
  }

  // Scroll-event based fetch trigger (TanStack Virtual pattern)
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const rows = table.getRowModel().rows;
  const colCount = table.getAllColumns().length + (props.showAddColumn ? 1 : 0);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () =>
      isInfiniteScrollMode ? scrollContainerRef.current : null,
    estimateSize: () => 40,
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() -
        virtualItems[virtualItems.length - 1].end
      : 0;

  const fetchMoreOnBottomReached = useCallback(
    (el?: HTMLDivElement | null) => {
      if (!el) return;
      const { scrollHeight, scrollTop, clientHeight } = el;
      if (
        scrollHeight - scrollTop - clientHeight < 300 &&
        hasNextPage &&
        !isFetchingNextPage
      ) {
        props.onFetchNextPage?.();
      }
    },
    [props.onFetchNextPage, hasNextPage, isFetchingNextPage],
  );

  // Also check on mount / when fetch state changes (handles short lists)
  useEffect(() => {
    if (isInfiniteScrollMode && hasMounted) {
      fetchMoreOnBottomReached(scrollContainerRef.current);
    }
  }, [fetchMoreOnBottomReached, isInfiniteScrollMode, hasMounted]);

  if (!hasMounted) {
    return null;
  }

  if (loading) {
    return (
      <div
        className={clsx(
          'flex flex-col items-center justify-center mt-8',
          className,
        )}
      >
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Loading {props.entityName ?? 'data'}...
        </div>
      </div>
    );
  }

  const shouldShowEmptyState =
    showEmptyState &&
    emptyStateConfig &&
    props.data.length === 0 &&
    !addRowContent;

  if (shouldShowEmptyState) {
    return (
      <div className={clsx('mt-8', className)}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-2xl border border-zinc-200 p-4 dark:border-white/10">
            <emptyStateConfig.icon className="size-8 text-zinc-400" />
          </div>
          <div className="mt-6 text-base font-semibold text-zinc-950 dark:text-white">
            {emptyStateConfig.title}
          </div>
          <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {emptyStateConfig.description}
          </div>
          <Button className="mt-6" onClick={emptyStateConfig.action.onClick}>
            {emptyStateConfig.action.label}
          </Button>
        </div>

        <AddColumnDialog
          isOpen={isAddColumnDialogOpen}
          onClose={closeAddColumnDialog}
          onAdd={(
            name: string,
            key: string,
            type: string,
            config?: ColumnConfig,
          ) => {
            onAddColumn?.(name, key, type, config);
          }}
        />
      </div>
    );
  }

  return (
    <div className={clsx('mt-8', className)}>
      <div
        ref={isInfiniteScrollMode ? scrollContainerRef : undefined}
        className={clsx(
          'flow-root overflow-hidden border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm bg-white dark:bg-zinc-950',
          isInfiniteScrollMode && 'overflow-y-auto max-h-[calc(100vh-260px)]',
        )}
        onScroll={
          isInfiniteScrollMode
            ? (e) => fetchMoreOnBottomReached(e.currentTarget)
            : undefined
        }
      >
        <Table
          grid
          dense
          className="[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)] text-sm"
        >
          <BaseTableHeader<TData>
            headerGroups={table.getHeaderGroups()}
            showAddColumn={showAddColumn}
            onAddColumn={openAddColumnDialog}
          />
          {isInfiniteScrollMode ? (
            <TableBody>
              {virtualItems.length > 0 ? (
                <>
                  {paddingTop > 0 && (
                    <tr>
                      <td colSpan={colCount} style={{ height: paddingTop }} />
                    </tr>
                  )}
                  {virtualItems.map((virtualRow) => (
                    <BaseTableRow<TData>
                      key={rows[virtualRow.index].id}
                      row={rows[virtualRow.index] as any}
                      disableRowClick={disableRowClick}
                      onRowClick={onRowClick}
                      showAddColumn={showAddColumn}
                      onCellUpdate={onCellUpdate}
                    />
                  ))}
                  {paddingBottom > 0 && (
                    <tr>
                      <td
                        colSpan={colCount}
                        style={{ height: paddingBottom }}
                      />
                    </tr>
                  )}
                </>
              ) : (
                rows.map((row) => (
                  <BaseTableRow<TData>
                    key={row.id}
                    row={row}
                    disableRowClick={disableRowClick}
                    onRowClick={onRowClick}
                    showAddColumn={showAddColumn}
                    onCellUpdate={onCellUpdate}
                  />
                ))
              )}
            </TableBody>
          ) : (
            <BaseTableBody<TData>
              rowModel={table.getRowModel()}
              disableRowClick={disableRowClick}
              onRowClick={onRowClick}
              showAddColumn={showAddColumn}
              onCellUpdate={onCellUpdate}
              addRowContent={addRowContent}
            />
          )}
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
        onAdd={(
          name: string,
          key: string,
          type: string,
          config?: ColumnConfig,
        ) => {
          onAddColumn?.(name, key, type, config);
        }}
      />

      {/* Infinite scroll status */}
      {isInfiniteScrollMode ? (
        <div className="mt-2">
          {isFetchingNextPage && (
            <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Loading more {props.entityName ?? 'records'}...
            </p>
          )}
          {!hasNextPage && props.totalCount !== undefined && (
            <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Showing all {props.totalCount} {props.entityName ?? 'records'}
            </p>
          )}
        </div>
      ) : (
        /* Pagination & Summary Footer */
        (props.totalCount !== undefined ||
          (!props.manualPagination &&
            (table.getCanNextPage() || table.getCanPreviousPage()))) && (
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
                    Showing {props.data.length} of {props.totalCount}{' '}
                    {props.entityName ?? 'results'}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Page {table.getState().pagination.pageIndex + 1} of{' '}
                    {table.getPageCount() || 1}
                  </p>
                )}
              </div>
              {(table.getCanNextPage() || table.getCanPreviousPage()) && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-zinc-500 dark:text-zinc-500 mr-2 flex items-center">
                    Rows per page:
                    <select
                      value={table.getState().pagination.pageSize}
                      onChange={(e) =>
                        table.setPageSize(Number(e.target.value))
                      }
                      className="ml-2 bg-transparent border-none text-zinc-700 dark:text-zinc-300 font-medium focus:ring-0 cursor-pointer text-sm"
                    >
                      {[10, 20, 30, 40, 50].map((pageSize) => (
                        <option
                          key={pageSize}
                          value={pageSize}
                          className="dark:bg-zinc-900"
                        >
                          {pageSize}
                        </option>
                      ))}
                    </select>
                  </span>
                  <nav
                    className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                    aria-label="Pagination"
                  >
                    <Button
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                      className="relative inline-flex items-center px-3 py-2 rounded-l-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                    >
                      <span className="sr-only">Previous</span>
                      <Image
                        src={CHEVRON_LEFT}
                        width={20}
                        height={20}
                        alt="Previous"
                      />
                    </Button>
                    <Button
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                      className="relative inline-flex items-center px-3 py-2 rounded-r-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                    >
                      <span className="sr-only">Next</span>
                      <Image
                        src={CHEVRON_RIGHT}
                        width={20}
                        height={20}
                        alt="Next"
                      />
                    </Button>
                  </nav>
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}

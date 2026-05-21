import type { Header, HeaderGroup } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import clsx from 'clsx';
import { useMemo } from 'react';
import { TableHead, TableHeader, TableRow, Button } from '@zuko/ui-kit';
import { PlusIcon } from '@heroicons/react/24/outline';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { BaseRow } from './types';

interface DraggableHeaderCellProps<TData extends BaseRow> {
  header: Header<TData, unknown>;
  isPinned: boolean;
}

const getHeaderStyles = <TData extends BaseRow>(
  header: Header<TData, unknown>,
) => {
  const isSno = header.column.id === 'sno';
  return {
    width: isSno ? header.column.getSize() : undefined,
    minWidth: isSno
      ? header.column.getSize()
      : (header.column.columnDef.minSize ?? 'auto'),
    maxWidth: isSno
      ? header.column.getSize()
      : (header.column.columnDef.maxSize ?? 'auto'),
  };
};

function DraggableHeaderCell<TData extends BaseRow>({
  header,
  isPinned,
}: DraggableHeaderCellProps<TData>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: header.id,
    disabled: isPinned,
  });
  return (
    <TableHeader
      colSpan={header.colSpan}
      className={clsx(
        'relative select-none transition-opacity duration-200',
        isPinned
          ? 'cursor-default'
          : isDragging
            ? 'cursor-grabbing'
            : 'cursor-grab',
        isDragging && 'opacity-50 z-10',
      )}
      style={{
        ...getHeaderStyles(header),
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div
        ref={setNodeRef}
        {...(isPinned ? {} : attributes)}
        {...(isPinned ? {} : listeners)}
      >
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
      </div>
    </TableHeader>
  );
}

interface BaseTableHeaderProps<TData extends BaseRow> {
  headerGroups: HeaderGroup<TData>[];
  showAddColumn?: boolean;
  onAddColumn?: () => void;
  columnReordering?: { storageKey: string };
  pinnedColumnIds?: string[];
}

export function BaseTableHeader<TData extends BaseRow>({
  headerGroups,
  showAddColumn,
  onAddColumn,
  columnReordering,
  pinnedColumnIds = [],
}: BaseTableHeaderProps<TData>) {
  const pinnedSet = useMemo(() => new Set(pinnedColumnIds), [pinnedColumnIds]);

  // Without column reordering, render a plain thead.
  if (!columnReordering) {
    return (
      <TableHead className="bg-zinc-50 dark:bg-zinc-900/50">
        {headerGroups.map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHeader
                key={header.id}
                colSpan={header.colSpan}
                className="select-none"
                style={getHeaderStyles(header)}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </TableHeader>
            ))}
            {showAddColumn && (
              <TableHeader className="w-10 !p-0">
                <Button
                  plain
                  onClick={onAddColumn}
                  aria-label="Add column"
                  className="flex h-10 w-full items-center justify-center !bg-transparent !border-none hover:!bg-transparent focus:!ring-0 shadow-none"
                >
                  <PlusIcon className="h-4 w-4 text-zinc-400 cursor-pointer" />
                </Button>
              </TableHeader>
            )}
          </TableRow>
        ))}
      </TableHead>
    );
  }

  // With column reordering: DndContext lives in BaseTable (outside <table>) so
  // the hidden accessibility <div> dnd-kit injects never ends up inside a table
  // element, which would be invalid HTML and trigger a React hydration error.
  // SortableContext renders no DOM nodes, so it is safe inside <thead>.
  // Column reordering is only supported for flat (single-headerGroup) tables.
  const columnIds = headerGroups[0]?.headers.map((h) => h.id) ?? [];
  return (
    <TableHead className="bg-zinc-50 dark:bg-zinc-900/50">
      <SortableContext
        items={columnIds}
        strategy={horizontalListSortingStrategy}
      >
        {headerGroups.map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <DraggableHeaderCell
                key={header.id}
                header={header}
                isPinned={pinnedSet.has(header.id)}
              />
            ))}
            {showAddColumn && (
              <TableHeader className="w-10 !p-0">
                <Button
                  plain
                  onClick={onAddColumn}
                  aria-label="Add column"
                  className="flex h-10 w-full items-center justify-center !bg-transparent !border-none hover:!bg-transparent focus:!ring-0 shadow-none"
                >
                  <PlusIcon className="h-4 w-4 text-zinc-400 cursor-pointer" />
                </Button>
              </TableHeader>
            )}
          </TableRow>
        ))}
      </SortableContext>
    </TableHead>
  );
}

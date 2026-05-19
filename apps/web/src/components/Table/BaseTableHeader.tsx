import type { Header, HeaderGroup } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import clsx from 'clsx';
import { useMemo } from 'react';
import { TableHead, TableHeader, TableRow, Button } from '@zuko/ui-kit';
import { PlusIcon } from '@heroicons/react/24/outline';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
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
  onColumnReorder?: (newOrder: string[]) => void;
}

export function BaseTableHeader<TData extends BaseRow>({
  headerGroups,
  showAddColumn,
  onAddColumn,
  columnReordering,
  pinnedColumnIds = [],
  onColumnReorder,
}: BaseTableHeaderProps<TData>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const pinnedSet = useMemo(() => new Set(pinnedColumnIds), [pinnedColumnIds]);

  function handleDragEnd(event: DragEndEvent, columnIds: string[]) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (pinnedSet.has(String(over.id))) return;

    const oldIndex = columnIds.indexOf(String(active.id));
    const newIndex = columnIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    onColumnReorder?.(arrayMove(columnIds, oldIndex, newIndex));
  }

  return (
    <TableHead className="bg-zinc-50 dark:bg-zinc-900/50">
      {headerGroups.map((headerGroup) => {
        const columnIds = headerGroup.headers.map((h) => h.id);

        const headerRow = (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) =>
              columnReordering ? (
                <DraggableHeaderCell
                  key={header.id}
                  header={header}
                  isPinned={pinnedSet.has(header.id)}
                />
              ) : (
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
              ),
            )}
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
        );

        if (!columnReordering) return headerRow;

        // One DndContext per header group. For flat tables this is a single
        // context. Grouped headers (multiple headerGroups) would produce sibling
        // contexts with shared sensors — avoid grouped headers with reordering.
        return (
          <DndContext
            key={headerGroup.id}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => handleDragEnd(event, columnIds)}
          >
            <SortableContext
              items={columnIds}
              strategy={horizontalListSortingStrategy}
            >
              {headerRow}
            </SortableContext>
          </DndContext>
        );
      })}
    </TableHead>
  );
}

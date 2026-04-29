import type { HeaderGroup } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import { TableHead, TableHeader, TableRow, Button } from '@zuko/ui-kit';
import { PlusIcon } from '@heroicons/react/24/outline';
import type { BaseRow } from './types';

interface BaseTableHeaderProps<TData extends BaseRow> {
  headerGroups: HeaderGroup<TData>[];
  showAddColumn?: boolean;
  onAddColumn?: () => void;
}

export function BaseTableHeader<TData extends BaseRow>({
  headerGroups,
  showAddColumn,
  onAddColumn,
}: BaseTableHeaderProps<TData>) {
  return (
    <TableHead className="bg-zinc-50 dark:bg-zinc-900/50">
      {headerGroups.map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          {headerGroup.headers.map((header) => {
            return (
              <TableHeader
                key={header.id}
                colSpan={header.colSpan}
                style={{
                  width:
                    header.column.id === 'sno'
                      ? header.column.getSize()
                      : undefined,
                  minWidth:
                    header.column.id === 'sno'
                      ? header.column.getSize()
                      : header.column.columnDef.minSize,
                  maxWidth:
                    header.column.id === 'sno'
                      ? header.column.getSize()
                      : header.column.columnDef.maxSize,
                }}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </TableHeader>
            );
          })}
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

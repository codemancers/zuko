import { HeaderGroup, flexRender } from '@tanstack/react-table';
import { TableHead, TableHeader, TableRow } from '@zuko/ui-kit';

interface BaseTableHeaderProps<TData> {
  headerGroups: HeaderGroup<TData>[];
}

export function BaseTableHeader<TData>({ headerGroups }: BaseTableHeaderProps<TData>) {
  return (
    <TableHead>
      {headerGroups.map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          {headerGroup.headers.map((header) => {
            return (
              <TableHeader
                key={header.id}
                colSpan={header.colSpan}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
              </TableHeader>
            );
          })}
        </TableRow>
      ))}
    </TableHead>
  );
}

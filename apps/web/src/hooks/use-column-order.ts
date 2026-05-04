import { useState, useEffect, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { ColumnMetadata } from '@/types/table-metadata';

function storageKey(entity: string) {
  return `zuko:column-order:${entity}`;
}

function deriveColumnIds(columns: ColumnDef<any, any>[]) {
  const all: string[] = [];
  const pinned: string[] = [];

  for (const c of columns) {
    const id = String(c.id ?? (c as any).accessorKey ?? '');
    if (!id) continue;
    all.push(id);
    if ((c.meta as { metadata?: ColumnMetadata })?.metadata?.pinned) {
      pinned.push(id);
    }
  }

  return { allColumnIds: ['sno', ...all], pinnedColumnIds: ['sno', ...pinned] };
}

export function useColumnOrder(key: string, columns: ColumnDef<any, any>[]) {
  const { allColumnIds, pinnedColumnIds } = useMemo(
    () => deriveColumnIds(columns),
    [columns],
  );

  const [columnOrder, setColumnOrderState] = useState<string[]>([]);

  const serializedIds = allColumnIds.join(',');

  useEffect(() => {
    if (!allColumnIds.length) return;

    try {
      const stored = localStorage.getItem(storageKey(key));
      if (!stored) {
        setColumnOrderState(allColumnIds);
        return;
      }

      const parsed: string[] = JSON.parse(stored);
      const validIds = new Set(allColumnIds);
      const pinnedSet = new Set(pinnedColumnIds);

      const reorderedStored = parsed.filter(
        (id) => validIds.has(id) && !pinnedSet.has(id),
      );
      const storedSet = new Set(reorderedStored);
      const newCols = allColumnIds.filter(
        (id) => !storedSet.has(id) && !pinnedSet.has(id),
      );

      setColumnOrderState([...pinnedColumnIds, ...reorderedStored, ...newCols]);
    } catch {
      setColumnOrderState(allColumnIds);
    }
  }, [key, serializedIds]);

  function setColumnOrder(newOrder: string[]) {
    setColumnOrderState(newOrder);
    try {
      localStorage.setItem(storageKey(key), JSON.stringify(newOrder));
    } catch {}
  }

  return [columnOrder, setColumnOrder, pinnedColumnIds] as const;
}

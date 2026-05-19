import { useState, useEffect, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { ColumnMetadata } from '@/types/table-metadata';
import type { BaseRow } from '@/components/Table/types';

function buildStorageKey(userId: string, entity: string) {
  return `zuko:column-order:${userId}:${entity}`;
}

function deriveColumnIds(columns: ColumnDef<BaseRow, unknown>[]) {
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

export function useColumnOrder(userId: string, key: string, columns: ColumnDef<BaseRow, unknown>[]) {
  const { allColumnIds, pinnedColumnIds } = useMemo(
    () => deriveColumnIds(columns),
    [columns],
  );

  const [columnOrder, setColumnOrderState] = useState<string[]>([]);

  const serializedIds = allColumnIds.join(',');

  useEffect(() => {
    if (!allColumnIds.length || !userId) return;

    try {
      const stored = localStorage.getItem(buildStorageKey(userId, key));
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
  }, [userId, key, serializedIds]);

  function setColumnOrder(newOrder: string[]) {
    setColumnOrderState(newOrder);
    try {
      if (userId) localStorage.setItem(buildStorageKey(userId, key), JSON.stringify(newOrder));
    } catch {}
  }

  return [columnOrder, setColumnOrder, pinnedColumnIds] as const;
}

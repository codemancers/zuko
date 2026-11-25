import type { SortingState } from '@tanstack/react-table';

/** Columns the members sheet can sort by. Anything else in the URL is ignored. */
export const SORTABLE = ['email', 'name', 'role'];

/** Reads the sheet's sort from `?sort=<column>&order=asc|desc`. */
export function readSorting(params: URLSearchParams): SortingState {
  const id = params.get('sort');
  if (!id || !SORTABLE.includes(id)) return [];
  return [{ id, desc: params.get('order') === 'desc' }];
}

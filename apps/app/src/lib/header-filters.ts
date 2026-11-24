import type { ColumnFiltersState } from '@tanstack/react-table';
import type { ColumnFilter, FieldDef } from '@/lib/records';

type Member = { value: string; label: string };
export type FacetEntry = { value: string | null; count: number };
export type FieldFacets = Record<string, FacetEntry[]>;

export function headerFilterKind(field: FieldDef) {
  if (
    !field.filterable ||
    field.sensitive ||
    field.type === 'LINK' ||
    (field.type === 'USER' && field.config.many)
  )
    return undefined;
  return field.type === 'TEXT' || field.type === 'EMAIL' ? 'text' : 'values';
}

/** A checklist uses readable member names and yes/no labels rather than ids and booleans. */
export function headerValue(
  field: FieldDef,
  value: string | null,
  members: Member[],
): string | null {
  if (value === null) return null;
  if (field.type === 'BOOLEAN') return value === 'true' ? 'Yes' : 'No';
  if (field.type === 'USER') {
    const member = members.find((entry) => entry.value === value);
    if (member)
      return members.some((entry) => entry.value !== value && entry.label === member.label)
        ? `${member.label} (${value})`
        : member.label;
  }
  return value;
}

export function toHeaderFilters(
  fields: FieldDef[],
  filters: ColumnFilter[],
  members: Member[],
): ColumnFiltersState {
  return fields.flatMap<ColumnFiltersState[number]>((field) => {
    const current = filters.filter((filter) => filter.field === field.name);
    if (headerFilterKind(field) === 'text') {
      const text = current.find((filter) => filter.op === 'CONTAINS');
      return text ? [{ id: field.name, value: text.value }] : [];
    }
    if (headerFilterKind(field) !== 'values') return [];
    const picked = current.find(
      (filter) => filter.op === 'IN' || filter.op === 'EQUALS' || filter.op === 'IS_NULL',
    );
    if (!picked) return [];
    const values: (string | null)[] =
      picked.op === 'IN'
        ? JSON.parse(picked.value)
        : picked.op === 'IS_NULL'
          ? [null]
          : [picked.value];
    return [{ id: field.name, value: values.map((value) => headerValue(field, value, members)) }];
  });
}

/** Replace only columns edited in the header; preserve older range/advanced filters in shared URLs. */
export function mergeHeaderFilters(
  fields: FieldDef[],
  previous: ColumnFiltersState,
  next: ColumnFiltersState,
  filters: ColumnFilter[],
  facets: FieldFacets,
  members: Member[],
): ColumnFilter[] {
  const changed = new Set(
    [...previous, ...next]
      .map((entry) => entry.id)
      .filter(
        (id) =>
          JSON.stringify(previous.find((entry) => entry.id === id)?.value) !==
          JSON.stringify(next.find((entry) => entry.id === id)?.value),
      ),
  );
  const result = filters.filter((filter) => !changed.has(filter.field));
  for (const entry of next) {
    if (!changed.has(entry.id)) continue;
    const field = fields.find((candidate) => candidate.name === entry.id);
    if (!field) continue;
    if (headerFilterKind(field) === 'text') {
      if (typeof entry.value === 'string' && entry.value.trim())
        result.push({ field: field.name, op: 'CONTAINS', value: entry.value.trim() });
    } else if (
      headerFilterKind(field) === 'values' &&
      Array.isArray(entry.value) &&
      entry.value.length
    ) {
      const existing = filters
        .filter((filter) => filter.field === field.name)
        .flatMap((filter): (string | null)[] =>
          filter.op === 'IN'
            ? JSON.parse(filter.value)
            : filter.op === 'IS_NULL'
              ? [null]
              : filter.op === 'EQUALS'
                ? [filter.value]
                : [],
        );
      const raw = [...(facets[field.name] ?? []).map((item) => item.value), ...existing];
      const values = entry.value.flatMap((picked): (string | null)[] => {
        const match = raw.find((value) => headerValue(field, value, members) === picked);
        return match === undefined ? [] : [match];
      });
      if (values.length)
        result.push({ field: field.name, op: 'IN', value: JSON.stringify([...new Set(values)]) });
    }
  }
  return result;
}

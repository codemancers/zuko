'use client';

import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { describeFilter, type ColumnFilter, type FieldDef } from '@/lib/records';

/** The filters in force, each removable, and a way to clear them all. */
export function FilterChips({
  fields,
  people = {},
  filters,
  onChange,
}: {
  fields: FieldDef[];
  people?: Record<string, string>;
  filters: ColumnFilter[];
  onChange: (filters: ColumnFilter[]) => void;
}) {
  if (filters.length === 0) return null;
  return (
    <ul
      aria-label="Active filters"
      className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-3 sm:px-6"
    >
      {filters.map((f, index) => {
        const text = describeFilter(fields, f, people);
        return (
          <li key={`${f.field}-${index}`}>
            <Badge variant="secondary" className="gap-1 pr-1">
              {text}
              <button
                type="button"
                aria-label={`Remove filter ${text}`}
                onClick={() => onChange(filters.filter((_, i) => i !== index))}
                className="rounded-full p-0.5 hover:bg-foreground/10"
              >
                <X className="size-3" aria-hidden />
              </button>
            </Badge>
          </li>
        );
      })}
      {filters.length > 1 && (
        <li>
          <Button variant="ghost" size="sm" onClick={() => onChange([])}>
            Clear all
          </Button>
        </li>
      )}
    </ul>
  );
}

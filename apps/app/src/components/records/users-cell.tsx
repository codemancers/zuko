'use client';

import { Plus, X } from 'lucide-react';
import { useSheetCellEditing } from '@codemancers/sheets';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/native-select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Option } from '@/components/records/pick-cell';

/**
 * A user field that holds several members, edited in place: the names show in the cell, and
 * clicking opens a panel to remove one or add another. Each change is saved at once.
 */
export function UsersCell({
  label,
  rowLabel,
  value,
  members,
}: {
  label: string;
  rowLabel: string;
  value: string[];
  members: Option[];
}) {
  const cell = useSheetCellEditing();
  const current = Array.isArray(cell.stagedValue)
    ? (cell.stagedValue as string[])
    : Array.isArray(cell.refusedValue)
      ? (cell.refusedValue as string[])
      : value;
  const nameOf = (id: string) => members.find((m) => m.value === id)?.label ?? id;
  const available = members.filter((m) => !current.includes(m.value));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label} of ${rowLabel}`}
          className="flex h-8 w-full items-center gap-1 overflow-hidden px-2 text-left outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Plus
            data-slot="link-add"
            className="size-3.5 shrink-0 text-muted-foreground/60"
            aria-hidden
          />
          <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            {current.map((id) => (
              <Badge key={id} variant="secondary" className="shrink-0">
                {nameOf(id)}
              </Badge>
            ))}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {label} of {rowLabel}
        </p>
        {current.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-1.5" aria-label={label}>
            {current.map((id) => (
              <li key={id}>
                <Badge variant="secondary" className="gap-1 pr-1">
                  {nameOf(id)}
                  <button
                    type="button"
                    aria-label={`Remove ${nameOf(id)}`}
                    onClick={() => void cell.stage(current.filter((other) => other !== id))}
                    className="rounded-full p-0.5 hover:bg-foreground/10"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        )}
        {available.length > 0 && (
          <NativeSelect
            aria-label={`Add to ${label}`}
            value=""
            onChange={(event) =>
              event.target.value && void cell.stage([...current, event.target.value])
            }
          >
            <option value="">Add a member…</option>
            {available.map((member) => (
              <option key={member.value} value={member.value}>
                {member.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </PopoverContent>
    </Popover>
  );
}

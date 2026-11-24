'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { LinkSearch } from '@/components/records/record-links';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AssociationDef, Linked } from '@/lib/records';

/**
 * A sheet cell for the records linked to a row. It shows their names; clicking it opens a
 * small panel to unlink any of them or search for more, and each change is saved at once.
 */
export function LinkCell({
  kind,
  linked,
  rowLabel,
  onChange,
}: {
  kind: AssociationDef;
  linked: Linked[];
  /** What the row is called, to name the control. */
  rowLabel: string;
  /** Saves one change; rejects with the reason it could not be saved. */
  onChange: (record: Linked, action: 'link' | 'unlink') => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function change(record: Linked, action: 'link' | 'unlink') {
    setBusy(true);
    setError(null);
    try {
      await onChange(record, action);
      return true;
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'That did not work. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover onOpenChange={(isOpen) => isOpen && setError(null)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${kind.label} of ${rowLabel}`}
          className="flex h-8 w-full items-center gap-1 overflow-hidden px-2 text-left outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {/* The + comes first, so adding is always in the same place however many names follow. */}
          <Plus
            data-slot="link-add"
            className="size-3.5 shrink-0 text-muted-foreground/60"
            aria-hidden
          />
          <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            {linked.map((record) => (
              <Badge key={record.id} variant="secondary" className="shrink-0">
                {record.label}
              </Badge>
            ))}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {kind.label} of {rowLabel}
          {!kind.many && ' · one at a time'}
        </p>
        {linked.length > 0 && (
          <ul
            className="mb-2 flex flex-wrap gap-1.5"
            aria-label={`Linked ${kind.label.toLowerCase()}`}
          >
            {linked.map((record) => (
              <li key={record.id}>
                <Badge variant="secondary" className="gap-1 pr-1">
                  <Link
                    href={`/records/${kind.target}?open=${record.id}`}
                    className="hover:underline"
                    title={`Open ${record.label}`}
                  >
                    {record.label}
                  </Link>
                  <button
                    type="button"
                    aria-label={`Unlink ${record.label}`}
                    disabled={busy}
                    onClick={() => void change(record, 'unlink')}
                    className="rounded-full p-0.5 hover:bg-foreground/10 disabled:opacity-50"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <LinkSearch association={kind} linked={linked} onAdd={(record) => change(record, 'link')} />
        {error && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

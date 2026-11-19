'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { LoaderCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import {
  recordLabel,
  searchBody,
  type AssociationDef,
  type Linked,
  type Links,
  type ObjectDef,
  type RecordsPage,
} from '@/lib/records';

const RESULTS = 8;

/** Find records of one kind by typing, and offer to link the ones not linked yet. */
export function LinkSearch({
  association,
  linked,
  onAdd,
}: {
  association: AssociationDef;
  linked: Linked[];
  onAdd: (record: Linked) => void | boolean | Promise<void | boolean>;
}) {
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [choosing, setChoosing] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const results = useRef<HTMLUListElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const typed = text.trim();
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(typed), 250);
    return () => clearTimeout(timer);
  }, [typed]);
  const matches = useQuery({
    queryKey: ['link-search', association.target, debounced],
    enabled: debounced !== '' && typed === debounced,
    queryFn: async ({ signal }) => {
      const def = await api<ObjectDef>(`/api/v1/objects/${association.target}`, { signal });
      const page = await api<RecordsPage>(`/api/v1/objects/${association.target}/records/filter`, {
        method: 'POST',
        signal,
        json: searchBody(def.fields, debounced, 1, RESULTS, null),
      });
      return page.results.map((row) => ({ id: row.id, label: recordLabel(def, row) }));
    },
  });
  const current =
    typed && typed === debounced && !matches.isPending
      ? {
          records: matches.data,
          problem: matches.error?.message,
        }
      : null;
  const chosen = new Set(linked.map((record) => record.id));
  const offered = current?.records?.filter((record) => !chosen.has(record.id)) ?? [];

  async function choose(record: Linked) {
    setChoosing(true);
    setSelectionError(null);
    try {
      if ((await onAdd(record)) !== false) setText('');
    } catch (error) {
      setSelectionError(
        error instanceof Error ? error.message : 'Could not link this record. Try again.',
      );
    } finally {
      setChoosing(false);
      requestAnimationFrame(() => input.current?.focus());
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        ref={input}
        type="search"
        aria-label={`Search ${association.label.toLowerCase()} to link`}
        placeholder={`Link ${association.singular_label.toLowerCase()}…`}
        value={text}
        disabled={choosing}
        onChange={(event) => {
          setText(event.target.value);
          setSelectionError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && offered.length > 0) {
            event.preventDefault();
            results.current?.querySelector('button')?.focus();
          }
        }}
      />
      {typed !== '' && !current && (
        <output className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <LoaderCircle className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />
          Searching…
        </output>
      )}
      {current?.problem && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-2.5"
        >
          <p className="text-xs text-destructive">{current.problem}</p>
          <Button variant="ghost" size="sm" className="mt-1" onClick={() => void matches.refetch()}>
            Retry search
          </Button>
        </div>
      )}
      {offered.length > 0 && (
        <ul
          ref={results}
          aria-label="Matching records"
          className="overflow-hidden divide-y rounded-lg border"
        >
          {offered.map((record, index) => (
            <li key={record.id}>
              <button
                type="button"
                aria-label={`Link ${record.label}`}
                disabled={choosing}
                onClick={() => void choose(record)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    const buttons = results.current?.querySelectorAll('button');
                    const next = index + (event.key === 'ArrowDown' ? 1 : -1);
                    if (next < 0) input.current?.focus();
                    else buttons?.[next % offered.length]?.focus();
                  }
                }}
                className="w-full px-3 py-2 text-left text-sm transition-colors outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:opacity-50"
              >
                {record.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {current?.records && offered.length === 0 && (
        <output className="px-1 text-xs text-muted-foreground">
          {current.records.length > 0 ? 'All matches are already linked.' : 'Nothing found.'}
        </output>
      )}
      {selectionError && (
        <p role="alert" className="text-xs text-destructive">
          {selectionError}
        </p>
      )}
    </div>
  );
}

/** For each kind of record this one can be linked to: who it is linked to now, and a way to change that. */
export function RecordLinks({
  associations,
  value,
  loading,
  onChange,
}: {
  associations: AssociationDef[];
  value: Links;
  loading: boolean;
  onChange: (name: string, linked: Linked[]) => void;
}) {
  if (associations.length === 0) return null;
  return (
    <div className="mt-6 flex flex-col gap-4 border-t pt-4">
      {associations.map((association) => {
        const linked = value[association.name] ?? [];
        return (
          <Field key={association.name}>
            <FieldLabel>
              {association.label}
              {!association.many && (
                <span className="font-normal text-muted-foreground"> · one at a time</span>
              )}
            </FieldLabel>
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : (
              <>
                {linked.length > 0 && (
                  <ul
                    className="flex flex-wrap gap-1.5"
                    aria-label={`Linked ${association.label.toLowerCase()}`}
                  >
                    {linked.map((record) => (
                      <li key={record.id}>
                        <Badge variant="secondary" className="gap-1 pr-1">
                          <Link
                            href={`/records/${association.target}?open=${record.id}`}
                            className="hover:underline"
                            title={`Open ${record.label}`}
                          >
                            {record.label}
                          </Link>
                          <button
                            type="button"
                            aria-label={`Unlink ${record.label}`}
                            onClick={() =>
                              onChange(
                                association.name,
                                linked.filter((l) => l.id !== record.id),
                              )
                            }
                            className="rounded-full p-0.5 hover:bg-foreground/10"
                          >
                            <X className="size-3" aria-hidden />
                          </button>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <LinkSearch
                  association={association}
                  linked={linked}
                  onAdd={(record) =>
                    onChange(association.name, association.many ? [...linked, record] : [record])
                  }
                />
              </>
            )}
          </Field>
        );
      })}
    </div>
  );
}

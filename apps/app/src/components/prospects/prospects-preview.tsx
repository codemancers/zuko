'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSheet } from '@codemancers/sheets';
import { Sheet, SheetTextCell } from '@codemancers/sheets/ui';
import { createColumnHelper } from '@tanstack/react-table';
import { ArrowLeft, ExternalLink, Plus, UserSearch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type ProspectFields = { name: string; company: string; linkedinUrl: string };
type PreviewProspect = ProspectFields & { id: number };
type View = { kind: 'list' } | { kind: 'create' } | { kind: 'detail' | 'edit'; id: number };

const emptyFields: ProspectFields = { name: '', company: '', linkedinUrl: '' };
const prospectColumn = createColumnHelper<PreviewProspect>();

// Deliberately local to this preview: not a proposed API or retained-field contract.
function ProspectForm({
  initial = emptyFields,
  editing = false,
  onSubmit,
  onCancel,
}: {
  initial?: ProspectFields;
  editing?: boolean;
  onSubmit: (fields: ProspectFields) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof ProspectFields, string>>>({});
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const fields = {
          name: draft.name.trim(),
          company: draft.company.trim(),
          linkedinUrl: draft.linkedinUrl.trim(),
        };
        const nextErrors: typeof errors = {};
        if (!fields.name) nextErrors.name = 'Enter a name.';
        if (!fields.company) nextErrors.company = 'Enter a company.';
        try {
          const url = new URL(fields.linkedinUrl);
          if (
            url.protocol !== 'https:' ||
            !['linkedin.com', 'www.linkedin.com'].includes(url.hostname) ||
            !/^\/in\/[^/]+\/?$/.test(url.pathname) ||
            url.username ||
            url.password ||
            url.port
          ) {
            throw new Error('Not a LinkedIn profile URL');
          }
        } catch {
          nextErrors.linkedinUrl =
            'Use an HTTPS LinkedIn profile URL, such as https://www.linkedin.com/in/example.';
        }
        setErrors(nextErrors);
        const firstInvalid = Object.keys(nextErrors)[0];
        if (firstInvalid) {
          event.currentTarget.querySelector<HTMLInputElement>(`#${firstInvalid}`)?.focus();
          return;
        }
        onSubmit(fields);
      }}
    >
      <FieldGroup>
        {Object.keys(errors).length > 0 && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
          >
            <p>Please check the highlighted fields.</p>
            <ul className="mt-2 list-inside list-disc">
              {Object.entries(errors).map(([key, message]) => (
                <li id={`${key}-error`} key={key}>
                  {message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(
          [
            ['name', 'Name'],
            ['company', 'Company'],
            ['linkedinUrl', 'LinkedIn URL'],
          ] as const
        ).map(([key, label]) => (
          <Field key={key}>
            <FieldLabel htmlFor={key}>{label}</FieldLabel>
            <Input
              id={key}
              required
              type={key === 'linkedinUrl' ? 'url' : 'text'}
              aria-invalid={!!errors[key]}
              aria-describedby={errors[key] ? `${key}-error` : undefined}
              value={draft[key]}
              onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
            />
          </Field>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{editing ? 'Apply to preview' : 'Add to preview'}</Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

export function ProspectsPreview() {
  const [prospects, setProspects] = useState<PreviewProspect[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>({ kind: 'list' });
  const nextId = useRef(1);
  const heading = useRef<HTMLHeadingElement>(null);
  const selected = 'id' in view ? prospects.find((person) => person.id === view.id) : undefined;
  useEffect(() => {
    heading.current?.focus();
  }, [view]);
  const search = query.trim().toLowerCase();
  const matches = prospects.filter((person) =>
    `${person.name} ${person.company}`.toLowerCase().includes(search),
  );
  const totalPages = Math.max(1, Math.ceil(matches.length / 5));
  const currentPage = Math.min(page, totalPages);
  const visible = matches.slice((currentPage - 1) * 5, currentPage * 5);
  const columns = useMemo(
    () => [
      prospectColumn.accessor('name', { header: 'Name', size: 240 }),
      prospectColumn.accessor('company', { header: 'Company', size: 240 }),
      prospectColumn.accessor('linkedinUrl', {
        header: 'LinkedIn',
        size: 280,
        cell: ({ getValue, row }) => (
          <SheetTextCell>
            <a
              href={getValue()}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View LinkedIn profile for ${row.original.name} (opens in a new tab)`}
              className="underline underline-offset-4"
            >
              {getValue()}
            </a>
          </SheetTextCell>
        ),
      }),
      prospectColumn.display({
        id: 'actions',
        header: 'Actions',
        size: 140,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`View ${row.original.name}`}
            onClick={() => setView({ kind: 'detail', id: row.original.id })}
          >
            View details
          </Button>
        ),
      }),
    ],
    [],
  );
  const sheet = useSheet({
    columns,
    data: visible,
    getRowId: (person) => String(person.id),
    // Pagination is owned by this preview; do not sort only the current page.
    enableSorting: false,
  });

  return (
    <div className="space-y-6">
      <section
        aria-label="Preview notice"
        className="rounded-xl border border-dashed bg-muted/50 p-4 text-sm"
      >
        <Badge variant="secondary">UI preview · not connected</Badge>
        <p className="mt-2">
          Changes stay in this page only and reset on reload or when you leave. Nothing is saved to
          Zuko.
        </p>
        <p className="mt-1 text-muted-foreground">
          Use test details only. These three fields are a starting point, not the final prospect
          form.
        </p>
      </section>
      {view.kind === 'list' ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 ref={heading} tabIndex={-1} className="font-heading text-2xl font-semibold">
                Prospects
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                People you want to start a conversation with.
              </p>
            </div>
            <Button onClick={() => setView({ kind: 'create' })}>
              <Plus aria-hidden />
              Add prospect
            </Button>
          </div>
          <Field className="max-w-md">
            <FieldLabel htmlFor="prospect-search">Search prospects</FieldLabel>
            <Input
              id="prospect-search"
              type="search"
              placeholder="Search by name or company"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </Field>
          <output className="block text-sm text-muted-foreground">
            {matches.length} {matches.length === 1 ? 'prospect' : 'prospects'} in this preview
          </output>
          <div className="h-96 min-w-0 overflow-hidden border bg-background">
            <Sheet
              instance={sheet}
              rowHeight={36}
              emptyState={
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <UserSearch className="size-8 text-muted-foreground" aria-hidden />
                  <h2 className="font-medium">
                    {search ? 'No matching prospects' : 'No prospects in this preview yet'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {search
                      ? 'Try another name or company.'
                      : 'Add a test prospect to try the list and detail view.'}
                  </p>
                  {search && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQuery('');
                        setPage(1);
                      }}
                    >
                      Clear search
                    </Button>
                  )}
                </div>
              }
            />
          </div>
          {matches.length > 0 && (
            <nav
              aria-label="Prospect pagination"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous page
                </Button>
                <Button
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next page
                </Button>
              </div>
            </nav>
          )}
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={() => setView({ kind: 'list' })}>
            <ArrowLeft aria-hidden />
            Back to prospects
          </Button>
          <Card className="mx-auto max-w-2xl">
            <CardHeader>
              <h1
                ref={heading}
                tabIndex={-1}
                className="font-heading text-xl font-semibold break-words"
              >
                {view.kind === 'create'
                  ? 'Add prospect'
                  : view.kind === 'edit'
                    ? 'Edit prospect'
                    : selected?.name}
              </h1>
            </CardHeader>
            <CardContent>
              {view.kind === 'create' || view.kind === 'edit' ? (
                <ProspectForm
                  initial={selected}
                  editing={view.kind === 'edit'}
                  onCancel={() =>
                    setView(selected ? { kind: 'detail', id: selected.id } : { kind: 'list' })
                  }
                  onSubmit={(fields) => {
                    const person = { ...fields, id: selected?.id ?? nextId.current++ };
                    setProspects(
                      selected
                        ? prospects.map((existing) =>
                            existing.id === selected.id ? person : existing,
                          )
                        : [...prospects, person],
                    );
                    setView({ kind: 'detail', id: person.id });
                  }}
                />
              ) : (
                selected && (
                  <>
                    <dl className="space-y-5 break-words">
                      <div>
                        <dt className="text-sm text-muted-foreground">Company</dt>
                        <dd className="mt-1">{selected.company}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">LinkedIn</dt>
                        <dd className="mt-1">
                          <a
                            href={selected.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 underline underline-offset-4"
                          >
                            View LinkedIn profile <ExternalLink className="size-4" aria-hidden />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        </dd>
                      </div>
                    </dl>
                    <Button
                      className="mt-6"
                      variant="outline"
                      onClick={() => setView({ kind: 'edit', id: selected.id })}
                    >
                      Edit prospect
                    </Button>
                  </>
                )
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

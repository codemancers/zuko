'use client';

import { useQuery } from '@tanstack/react-query';
import { objectListQuery, permissionsQuery } from '@/lib/queries';
import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createColumnHelper } from '@tanstack/react-table';
import { AlertCircle, Plus } from 'lucide-react';
import { useSheet } from '@codemancers/sheets';
import { Sheet, SheetPrimaryCell, SheetTextCell } from '@codemancers/sheets/ui';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { OBJECTS_CHANGED } from '@/lib/objects-events';
import { keyFromLabel } from '@/lib/records';

type ObjectRow = {
  id: string;
  name: string;
  label: string;
  plural_label: string;
  object_kind: 'STANDARD' | 'CUSTOM';
  field_count: number;
};
type Link = {
  id: string;
  name: string;
  label: string;
  source: { name: string; label: string };
  target: { name: string; label: string };
};

const NO_LINKS: Link[] = [];

const col = createColumnHelper<ObjectRow & { links: string[] }>();
const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong';

/** The form to make a new kind of record. It starts with a Name field, so it can be used at once. */
function NewObjectDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [plural, setPlural] = useState('');
  const [key, setKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [problem, setProblem] = useState<{ field?: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLabel('');
      setPlural('');
      setKey('');
      setKeyEdited(false);
      setProblem(null);
    }
  }

  async function submit() {
    setSaving(true);
    setProblem(null);
    try {
      await api('/api/v1/objects', {
        method: 'POST',
        json: {
          slug: key,
          label: label.trim(),
          ...(plural.trim() ? { plural_label: plural.trim() } : {}),
        },
      });
      try {
        await api(`/api/v1/objects/${key}/fields`, {
          method: 'POST',
          json: { name: 'name', label: 'Name', type: 'TEXT', required: true, filterable: true },
        });
      } catch (error) {
        setProblem({
          message: `The object was created, but its Name field was not: ${messageOf(error)}. Add it from the object's page.`,
        });
        onCreated(key);
        return;
      }
      onCreated(key);
    } catch (error) {
      setProblem({
        field: error instanceof ApiError ? error.errors[0]?.field : undefined,
        message: messageOf(error),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && !saving && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>New object</DrawerTitle>
          <DrawerDescription>
            A new kind of record, with its own page and fields. You can link it to others
            afterwards.
          </DrawerDescription>
        </DrawerHeader>
        {problem && (
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>{problem.message}</AlertDescription>
          </Alert>
        )}
        <DrawerBody>
          <form
            id="new-object-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="new-object-label">Name (singular) *</FieldLabel>
                <Input
                  id="new-object-label"
                  required
                  maxLength={100}
                  placeholder="Project"
                  value={label}
                  onChange={(event) => {
                    setLabel(event.target.value);
                    if (!keyEdited) setKey(keyFromLabel(event.target.value));
                  }}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-object-plural">Name (plural)</FieldLabel>
                <Input
                  id="new-object-plural"
                  maxLength={100}
                  placeholder={label ? `${label.trim()}s` : 'Projects'}
                  value={plural}
                  onChange={(event) => setPlural(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-object-key">Key *</FieldLabel>
                <Input
                  id="new-object-key"
                  required
                  value={key}
                  aria-invalid={problem?.field === 'slug' ? true : undefined}
                  onChange={(event) => {
                    setKeyEdited(true);
                    setKey(event.target.value);
                  }}
                />
                <FieldDescription>
                  Lowercase letters, digits and underscores. It cannot be changed later.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </DrawerBody>
        <DrawerFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-object-form" disabled={saving}>
            {saving ? 'Creating…' : 'Create object'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/** Every kind of record the organization has, what each is linked to, and where to make more. */
export function ObjectsSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const objectsQuery = useQuery(objectListQuery);
  const associationQuery = useQuery({
    queryKey: ['association-definitions'],
    queryFn: ({ signal }) => api<{ results: Link[] }>('/api/v1/associations', { signal }),
  });
  const permissionQuery = useQuery(permissionsQuery);
  const objects = objectsQuery.data?.results ?? null;
  const links = associationQuery.data?.results ?? NO_LINKS;
  const canManage = permissionQuery.data?.can_manage_objects === true;
  const error = objectsQuery.error ?? associationQuery.error ?? permissionQuery.error;
  const problem = error ? messageOf(error) : null;

  const creating = searchParams.get('new_object') === '1';
  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const rows = useMemo(
    () =>
      (objects ?? []).map((o) => ({
        ...o,
        // The kinds of record it can be linked to; two links to the same kind (a primary and a secondary contact) count once.
        links: [
          ...new Set(
            links.flatMap((l) =>
              l.source.name === o.name
                ? [l.target.label]
                : l.target.name === o.name
                  ? [l.source.label]
                  : [],
            ),
          ),
        ],
      })),
    [objects, links],
  );

  const columns = useMemo(
    () => [
      col.accessor('label', {
        header: 'Object',
        size: 260,
        enableSorting: false,
        cell: ({ row }) => (
          <SheetPrimaryCell href={`/records/${row.original.name}`}>
            {row.original.plural_label}
          </SheetPrimaryCell>
        ),
      }),
      col.accessor('name', {
        header: 'Key',
        size: 180,
        enableSorting: false,
        cell: ({ row }) => <SheetTextCell>{row.original.name}</SheetTextCell>,
      }),
      col.accessor('object_kind', {
        header: 'Kind',
        size: 120,
        enableSorting: false,
        cell: ({ row }) => (
          <SheetTextCell className="flex items-center">
            <Badge variant="secondary">
              {row.original.object_kind === 'STANDARD' ? 'Standard' : 'Custom'}
            </Badge>
          </SheetTextCell>
        ),
      }),
      col.accessor('field_count', {
        header: 'Fields',
        size: 100,
        enableSorting: false,
        cell: ({ row }) => (
          <SheetTextCell className="text-right tabular-nums">
            {row.original.field_count}
          </SheetTextCell>
        ),
      }),
      col.accessor('links', {
        header: 'Linked to',
        size: 320,
        enableSorting: false,
        cell: ({ row }) => <SheetTextCell>{row.original.links.join(', ')}</SheetTextCell>,
      }),
    ],
    [],
  );

  const sheet = useSheet({ columns, data: rows, getRowId: (row) => row.id, manualSorting: true });

  const changed = () => {
    void objectsQuery.refetch();
    void associationQuery.refetch();
    window.dispatchEvent(new Event(OBJECTS_CHANGED)); // the sidebar lists them too
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <p className="text-sm text-muted-foreground">
          The kinds of record in this organization. Open one to see and edit its records and fields;
          links to other objects are added there, as fields.
        </p>
        {canManage && (
          <Button onClick={() => update({ new_object: '1' })}>
            <Plus aria-hidden /> New object
          </Button>
        )}
      </div>
      {problem && (
        <div className="px-4 pb-4 sm:px-6">
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>{problem}</AlertDescription>
          </Alert>
        </div>
      )}
      <div className="min-h-0 flex-1 border-t">
        <Sheet
          instance={sheet}
          isLoading={objects === null && !problem}
          emptyState="No objects yet."
          onAddRow={canManage ? () => update({ new_object: '1' }) : undefined}
          labels={{ addRow: 'Add object' }}
        />
      </div>
      <NewObjectDrawer
        open={canManage && creating}
        onClose={() => update({ new_object: null })}
        onCreated={() => {
          update({ new_object: null });
          changed();
        }}
      />
    </div>
  );
}

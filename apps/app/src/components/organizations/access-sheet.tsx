'use client';

import { useQuery } from '@tanstack/react-query';
import { objectListQuery, type ObjectSummary } from '@/lib/queries';
import { useMemo, useState } from 'react';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { useCellStatus, useRowChanges, useSheet } from '@codemancers/sheets';
import { Sheet, SheetActionsCell, SheetTextCell } from '@codemancers/sheets/ui';
import { PickCell } from '@/components/records/pick-cell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';

type Scope = 'OWN' | 'OWN_AND_REPORTS' | 'TEAM' | 'ALL';
type Access = {
  defaults: Record<string, { read_scope: Scope; write_scope: Scope }>;
  overrides: { role: string; object: string | null; read_scope: Scope; write_scope: Scope }[];
};
type Row = { id: string; label: string; object: string | null };

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'OWN', label: 'Their own' },
  { value: 'OWN_AND_REPORTS', label: 'Their own and their reports’' },
  { value: 'TEAM', label: 'Their own and their team’s' },
  { value: 'ALL', label: 'Everything' },
];
/** These always have full access, so an organization cannot lock itself out of its own data. */
const FIXED_ROLES = ['owner', 'admin'];
const NO_OBJECTS: ObjectSummary[] = [];
const ALL_OBJECTS = 'all';

const col = createColumnHelper<Row>();
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Which records each role may see and change, for all objects and for any one of them. A setting
 * on one object overrides the one for all objects, which overrides the built-in default.
 */
export function AccessSheet() {
  const accessQuery = useQuery({
    queryKey: ['access-roles'],
    queryFn: ({ signal }) => api<Access>('/api/v1/access/roles', { signal }),
  });
  const objectsQuery = useQuery(objectListQuery);
  const access = accessQuery.data ?? null;
  const objects = objectsQuery.data?.results ?? NO_OBJECTS;
  const [mutationProblem, setProblem] = useState<string | null>(null);
  const error = accessQuery.error ?? objectsQuery.error;
  const problem =
    mutationProblem ??
    (error instanceof ApiError && error.status === 403
      ? 'Only owners and admins can see access settings.'
      : error?.message);

  const roles = useMemo(
    () => Object.keys(access?.defaults ?? {}).filter((role) => !FIXED_ROLES.includes(role)),
    [access],
  );
  const rows = useMemo<Row[]>(
    () => [
      { id: ALL_OBJECTS, label: 'All objects', object: null },
      ...objects.map((o) => ({ id: o.name, label: o.plural_label, object: o.name })),
    ],
    [objects],
  );

  const override = (role: string, object: string | null) =>
    access?.overrides.find((o) => o.role === role && o.object === object);
  /** What a role gets on an object: its own setting, else the one for all objects, else the default. */
  const effective = (role: string, object: string | null) => {
    const found =
      override(role, object) ??
      (object ? override(role, null) : undefined) ??
      access?.defaults[role];
    return { read: found?.read_scope ?? 'OWN', write: found?.write_scope ?? 'OWN' };
  };

  const cellStatus = useCellStatus();
  const rowChanges = useRowChanges({
    cellStatus,
    onSubmitRow: async (rowId, changes) => {
      const object = rowId === ALL_OBJECTS ? null : rowId;
      try {
        for (const role of roles) {
          const read = changes[`${role}:read`];
          const write = changes[`${role}:write`];
          if (read === undefined && write === undefined) continue;
          const now = effective(role, object);
          await api(`/api/v1/access/roles/${role}`, {
            method: 'PUT',
            json: { object, read_scope: read ?? now.read, write_scope: write ?? now.write },
          });
        }
        void accessQuery.refetch();
        return undefined;
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Could not save that.' };
      }
    },
  });

  async function reset(row: Row) {
    setProblem(null);
    try {
      for (const role of roles) {
        if (override(role, row.object)) {
          await api(`/api/v1/access/roles/${role}${row.object ? `?object=${row.object}` : ''}`, {
            method: 'DELETE',
          });
        }
      }
      void accessQuery.refetch();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Could not reset that.');
    }
  }

  const columns = useMemo(
    () => [
      col.accessor('label', {
        header: 'Object',
        size: 220,
        enableSorting: false,
        cell: ({ row }) => <SheetTextCell>{row.original.label}</SheetTextCell>,
      }),
      ...roles.flatMap((role) =>
        (['read', 'write'] as const).map(
          (mode) =>
            col.display({
              id: `${role}:${mode}`,
              header: `${capitalise(role)} can ${mode === 'read' ? 'see' : 'change'}`,
              size: 250,
              enableSorting: false,
              cell: ({ row }) => (
                <PickCell
                  label={`${capitalise(role)} can ${mode === 'read' ? 'see' : 'change'} ${row.original.label}`}
                  value={effective(role, row.original.object)[mode]}
                  options={SCOPES}
                />
              ),
            }) as ColumnDef<Row, unknown>,
        ),
      ),
      col.display({
        id: 'source',
        header: 'Setting',
        size: 150,
        enableSorting: false,
        cell: ({ row }) => {
          const custom = roles.some((role) => override(role, row.original.object));
          return (
            <SheetTextCell className="flex items-center">
              <Badge variant={custom ? 'default' : 'secondary'}>
                {custom ? 'Custom' : row.original.object ? 'Inherited' : 'Default'}
              </Badge>
            </SheetTextCell>
          );
        },
      }) as ColumnDef<Row, unknown>,
      col.display({
        id: 'actions',
        header: 'Actions',
        size: 120,
        enableSorting: false,
        cell: ({ row }) =>
          roles.some((role) => override(role, row.original.object)) ? (
            <SheetActionsCell className="py-1!">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Reset ${row.original.label}`}
                onClick={() => void reset(row.original)}
              >
                <RotateCcw aria-hidden /> Reset
              </Button>
            </SheetActionsCell>
          ) : null,
      }) as ColumnDef<Row, unknown>,
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roles, access],
  );

  const sheet = useSheet({
    columns: columns as ColumnDef<Row, unknown>[],
    data: rows,
    getRowId: (row) => row.id,
    cellStatus,
    rowChanges,
    manualSorting: true,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="px-4 py-4 sm:px-6 text-sm text-muted-foreground">
        Which records each role can see and change. Owners and admins always have access to
        everything. A setting for one object overrides the one for all objects.
      </p>
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
          isLoading={access === null && !problem}
          emptyState="No objects yet."
        />
      </div>
    </div>
  );
}

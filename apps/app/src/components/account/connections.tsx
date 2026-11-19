'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSheet } from '@codemancers/sheets';
import { Sheet, SheetActionsCell, SheetTextCell } from '@codemancers/sheets/ui';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, PlugZap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { api, MCP_URL } from '@/lib/api';
import { describeScopes } from '@/lib/oauth-scopes';

export type Connection = {
  id: string;
  client: { id: string; name: string | null; uri: string | null };
  organization: { id: string; name: string | null } | null;
  scopes: string[];
  connected_at: string;
};

const NO_CONNECTIONS: Connection[] = [];
const col = createColumnHelper<Connection>();

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The applications (MCP clients) this person has approved, with a way to cut each one off.
 * Disconnecting takes effect immediately; the app has to be approved again to come back.
 */
export function Connections() {
  const client = useQueryClient();
  const connectionsQuery = useQuery({
    queryKey: ['connections'],
    queryFn: ({ signal }) => api<{ results: Connection[] }>('/api/v1/connections', { signal }),
  });
  const connections = connectionsQuery.data?.results ?? NO_CONNECTIONS;
  const [mutationError, setError] = useState<string | null>(null);
  const error = mutationError ?? connectionsQuery.error?.message;
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const disconnect = useCallback(
    async (id: string) => {
      setBusy(id);
      setError(null);
      try {
        await api(`/api/v1/connections/${id}`, { method: 'DELETE' });
        client.setQueryData<{ results: Connection[] }>(['connections'], (current) =>
          current
            ? { results: current.results.filter((connection) => connection.id !== id) }
            : current,
        );
        setConfirming(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not disconnect this app.');
      } finally {
        setBusy(null);
      }
    },
    [client],
  );

  const columns = useMemo<ColumnDef<Connection, unknown>[]>(
    () => [
      col.display({
        id: 'application',
        header: 'Application',
        size: 220,
        enableSorting: false,
        cell: ({ row }) => (
          <SheetTextCell className="font-medium">
            {row.original.client.name ?? 'Unnamed application'}
          </SheetTextCell>
        ),
      }),
      col.display({
        id: 'organization',
        header: 'Organization',
        size: 240,
        enableSorting: false,
        cell: ({ row }) => (
          <SheetTextCell>
            {row.original.organization?.name ?? 'An organization you no longer have'}
          </SheetTextCell>
        ),
      }),
      col.display({
        id: 'access',
        header: 'Access',
        size: 340,
        enableSorting: false,
        cell: ({ row }) => (
          <SheetTextCell className="space-y-1 whitespace-normal">
            {describeScopes(row.original.scopes).map((scope) => (
              <span key={scope} className="block">
                {scope}
              </span>
            ))}
          </SheetTextCell>
        ),
      }),
      col.accessor('connected_at', {
        header: 'Connected',
        size: 160,
        enableSorting: false,
        cell: ({ row }) => <SheetTextCell>{formatDate(row.original.connected_at)}</SheetTextCell>,
      }) as ColumnDef<Connection, unknown>,
      col.display({
        id: 'actions',
        header: 'Actions',
        size: 320,
        enableSorting: false,
        cell: ({ row }) => {
          const connection = row.original;
          const asking = confirming === connection.id;
          return (
            <SheetActionsCell className="flex-col items-start!">
              <div className="flex gap-2">
                {asking && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => setConfirming(null)}
                  >
                    Keep connected
                  </Button>
                )}
                <Button
                  variant={asking ? 'destructive' : 'outline'}
                  size="sm"
                  disabled={busy !== null}
                  onClick={() =>
                    asking ? void disconnect(connection.id) : setConfirming(connection.id)
                  }
                >
                  {busy === connection.id
                    ? 'Disconnecting…'
                    : asking
                      ? 'Yes, disconnect'
                      : 'Disconnect'}
                </Button>
              </div>
              {asking && (
                <p className="text-xs text-muted-foreground">
                  {connection.client.name ?? 'This application'} will stop working right away and
                  will need your approval to connect again.
                </p>
              )}
            </SheetActionsCell>
          );
        },
      }),
    ],
    [busy, confirming, disconnect],
  );
  const sheet = useSheet({
    columns,
    data: connections,
    getRowId: (row) => row.id,
    manualSorting: true,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {error && (
        <div className="px-4 pb-4 sm:px-6">
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          {connectionsQuery.isError && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void connectionsQuery.refetch()}
            >
              Retry loading apps
            </Button>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 border-t">
        <Sheet
          instance={sheet}
          rowHeight={44}
          isLoading={connectionsQuery.isPending}
          emptyState={
            connectionsQuery.isError ? (
              'Connected apps could not be loaded.'
            ) : (
              <div className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-12 text-center">
                <span className="flex size-10 items-center justify-center rounded-2xl border bg-primary/10 text-muted-foreground">
                  <PlugZap className="size-5" aria-hidden />
                </span>
                <p className="text-base font-semibold">No connected apps</p>
                <p className="text-sm text-muted-foreground">
                  To connect an app such as Claude or Cursor, add this server address to it and
                  approve the connection when asked:
                </p>
                <code className="max-w-full break-all rounded-lg border bg-muted/50 px-3 py-2 text-xs">
                  {MCP_URL}
                </code>
              </div>
            )
          }
        />
      </div>
    </div>
  );
}

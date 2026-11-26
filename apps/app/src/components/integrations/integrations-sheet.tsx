'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useSheet } from '@codemancers/sheets';
import { Sheet, SheetPrimaryCell, SheetTextCell } from '@codemancers/sheets/ui';
import { createColumnHelper } from '@tanstack/react-table';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ApolloDrawer, apolloStatusQuery } from './apollo-drawer';

interface Row {
  id: string;
  name: string;
  description: string;
  connected: boolean | null;
  account: string | null;
}

const col = createColumnHelper<Row>();

/** The services Zuko can connect to. Each opens its own drawer; add a row here and a drawer for the next one. */
const INTEGRATIONS = [
  { id: 'apollo', name: 'Apollo', description: 'Enrich contacts, prospects, leads and companies with Apollo data.' },
] as const;

/** Every integration and whether it is on. Open one to connect it, replace its key or remove it. */
export function IntegrationsSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const apollo = useQuery(apolloStatusQuery);
  const open = searchParams.get('open');
  const openId = INTEGRATIONS.some((i) => i.id === open) ? open : null;

  const setOpen = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (id === null) next.delete('open');
      else next.set('open', id);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const rows = useMemo<Row[]>(
    () =>
      INTEGRATIONS.map((integration) => ({
        ...integration,
        connected: apollo.data ? apollo.data.connected : null,
        account: apollo.data?.account ?? null,
      })),
    [apollo.data],
  );

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: 'Integration',
        size: 220,
        enableSorting: false,
        cell: ({ row }) => (
          <SheetPrimaryCell onOpen={() => setOpen(row.original.id)} openLabel={`Open ${row.original.name}`}>
            {row.original.name}
          </SheetPrimaryCell>
        ),
      }),
      col.accessor('description', {
        header: 'What it does',
        size: 420,
        enableSorting: false,
        cell: ({ row }) => <SheetTextCell>{row.original.description}</SheetTextCell>,
      }),
      col.accessor('connected', {
        header: 'Status',
        size: 160,
        enableSorting: false,
        cell: ({ row }) => (
          <SheetTextCell className="flex items-center">
            {row.original.connected === null ? (
              <span className="text-muted-foreground">…</span>
            ) : (
              <Badge variant={row.original.connected ? 'default' : 'secondary'}>
                {row.original.connected ? 'Connected' : 'Not connected'}
              </Badge>
            )}
          </SheetTextCell>
        ),
      }),
      col.accessor('account', {
        header: 'Account',
        size: 260,
        enableSorting: false,
        cell: ({ row }) => <SheetTextCell>{row.original.account ?? ''}</SheetTextCell>,
      }),
    ],
    [setOpen],
  );

  const sheet = useSheet({ columns, data: rows, getRowId: (row) => row.id, manualSorting: true });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="px-4 py-4 text-sm text-muted-foreground sm:px-6">
        Services this organization has connected. Open one to connect it or change its key.
      </p>
      {apollo.error && (
        <div className="px-4 pb-4 sm:px-6">
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>{apollo.error.message}</AlertDescription>
          </Alert>
        </div>
      )}
      <div className="min-h-0 flex-1 border-t">
        <Sheet instance={sheet} openRowId={openId} emptyState="No integrations." />
      </div>
      <ApolloDrawer open={openId === 'apollo'} onClose={() => setOpen(null)} />
    </div>
  );
}

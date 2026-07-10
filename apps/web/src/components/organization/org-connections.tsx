'use client';

import Image from 'next/image';
import { Button, Divider, Subheading, Text } from '@zuko/ui-kit';
import {
  BaseTable,
  createColumnsFromMetadata,
  type BaseRow,
} from '@/components/Table';
import type { ColumnDef } from '@tanstack/react-table';
import type { ColumnMetadata } from '@/types/table-metadata';
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Nango from '@nangohq/frontend';
import {
  githubStatusQueryOptions,
  linkedAccountsQueryOptions,
} from './server/query-options';
import {
  useConnectAccount,
  useDisconnectAccount,
  useInstallGitHubApp,
} from './hooks/mutations';
import { authClient } from '@/lib/auth-client';
import {
  activateApolloConnection,
  disconnectApollo,
} from '@/server/actions/apollo';
import {
  getApolloConnectionStatus,
  getApolloUsageStats,
} from '@/server/query-options';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConnectionRow = {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: 'connected' | 'not-connected';
  connectedBy?: string;
  connectedAt?: Date;
};

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const GitHubIcon = () => (
  <Image src="/icons/github.svg" alt="GitHub" width={20} height={20} />
);
const GoogleCalendarIcon = () => (
  <Image
    src="/icons/google-calendar.svg"
    alt="Google Calendar"
    width={20}
    height={20}
  />
);

const ApolloIcon = () => (
  <Image src="/icons/apollo.svg" alt="Apollo.io" width={20} height={20} />
);

// ---------------------------------------------------------------------------
// Table metadata
// ---------------------------------------------------------------------------

const CONNECTION_TABLE_METADATA: ColumnMetadata[] = [
  {
    id: 'status',
    header: 'Status',
    fieldType: 'select',
    dataType: 'text',
    editable: false,
    isVisible: true,
    config: {
      render: 'badge',
      colorMap: { connected: 'lime', 'not-connected': 'zinc' },
      options: [
        { label: 'Connected', value: 'connected' },
        { label: 'Disconnected', value: 'not-connected' },
      ],
    },
  },
  {
    id: 'connectedBy',
    header: 'Connected By',
    fieldType: 'text',
    dataType: 'text',
    editable: false,
    isVisible: true,
  },
  {
    id: 'connectedAt',
    header: 'Date',
    fieldType: 'date',
    dataType: 'date',
    editable: false,
    isVisible: true,
    config: { format: 'date' },
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const OrgConnections = () => {
  const session = authClient.useSession();
  const userEmail = session?.data?.user?.email ?? undefined;
  const queryClient = useQueryClient();

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  const { data: ghAppStatus, isLoading: loadingApp } = useQuery(
    githubStatusQueryOptions(),
  );
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery(
    linkedAccountsQueryOptions(),
  );
  const { data: apolloStatus, isLoading: loadingApollo } = useQuery({
    ...getApolloConnectionStatus(),
    retry: false,
  });
  const apolloConnected = apolloStatus?.connected ?? false;

  const { data: usageStats } = useQuery({
    ...getApolloUsageStats(),
    enabled: apolloConnected,
  });

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const connectAccount = useConnectAccount();
  const disconnectAccount = useDisconnectAccount();
  const installGitHubApp = useInstallGitHubApp();

  const connectApollo = useMutation({
    mutationFn: async () => {
      // Allowed integrations are decided server-side; the endpoint
      // takes no body.
      const res = await fetch('/api/proxy/api/nango/session', {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(`Failed to create Nango session (${res.status})`);
      }
      const { sessionToken } = (await res.json()) as {
        sessionToken: string;
      };

      const nango = new Nango({
        connectSessionToken: sessionToken,
        // Unset → SDK defaults to Nango Cloud (https://api.nango.dev)
        ...(process.env.NEXT_PUBLIC_NANGO_HOST
          ? { host: process.env.NEXT_PUBLIC_NANGO_HOST }
          : {}),
      });
      const result = await nango.auth('apollo-oauth');
      await activateApolloConnection(result.connectionId);
    },
    onSuccess: () => {
      toast.success('Apollo connected');
      queryClient.invalidateQueries({
        queryKey: ['apollo', 'connection-status'],
      });
    },
    onError: () => toast.error('Failed to connect Apollo'),
  });

  const disconnectApolloMutation = useMutation({
    mutationFn: disconnectApollo,
    onSuccess: () => {
      toast.success('Apollo disconnected');
      queryClient.invalidateQueries({
        queryKey: ['apollo', 'connection-status'],
      });
    },
    onError: () => toast.error('Failed to disconnect Apollo'),
  });

  // -------------------------------------------------------------------------
  // Column definitions
  // -------------------------------------------------------------------------

  const nameColumn: ColumnDef<BaseRow> = useMemo(
    () => ({
      id: 'name',
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => {
        const conn = row.original as ConnectionRow;
        return (
          <div className="flex items-center gap-3 py-0.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
              {conn.icon}
            </div>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {conn.name}
            </span>
          </div>
        );
      },
    }),
    [],
  );

  const integrationActionsColumn: ColumnDef<BaseRow> = useMemo(
    () => ({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const { id, status } = row.original as ConnectionRow;
        const connected = status === 'connected';

        if (id === 'github-app') {
          return (
            <Button
              plain
              disabled={installGitHubApp.isPending}
              onClick={() => installGitHubApp.mutate()}
              className="!text-blue-500 dark:!text-blue-400"
            >
              {connected ? 'Re-install' : 'Install'}
            </Button>
          );
        }

        if (id === 'apollo') {
          return (
            <div className="flex items-center gap-1">
              {connected ? (
                <>
                  <Button
                    plain
                    disabled={disconnectApolloMutation.isPending}
                    onClick={() => disconnectApolloMutation.mutate()}
                    className="!text-red-500 dark:!text-red-400"
                  >
                    Disconnect
                  </Button>
                  <Button
                    plain
                    disabled={connectApollo.isPending}
                    onClick={() => connectApollo.mutate()}
                    className="!text-blue-500 dark:!text-blue-400"
                  >
                    Reconnect
                  </Button>
                </>
              ) : (
                <Button
                  plain
                  disabled={connectApollo.isPending}
                  onClick={() => connectApollo.mutate()}
                  className="!text-blue-500 dark:!text-blue-400"
                >
                  {connectApollo.isPending ? 'Connecting...' : 'Connect'}
                </Button>
              )}
            </div>
          );
        }
        return null;
      },
    }),
    [installGitHubApp, connectApollo, disconnectApolloMutation],
  );

  const connectionActionsColumn: ColumnDef<BaseRow> = useMemo(
    () => ({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const { id, status } = row.original as ConnectionRow;
        const connected = status === 'connected';
        const provider = id as 'github' | 'google';
        const isConnecting =
          connectAccount.isPending && connectAccount.variables === provider;
        const isPending = isConnecting;

        return (
          <div className="flex items-center gap-1">
            {connected ? (
              <>
                <Button
                  plain
                  disabled={isPending}
                  onClick={() => disconnectAccount.mutate(id)}
                  className="!text-red-500 dark:!text-red-400"
                >
                  Disconnect
                </Button>
                <Button
                  plain
                  disabled={isPending}
                  onClick={() => connectAccount.mutate(provider)}
                  className="!text-blue-500 dark:!text-blue-400"
                >
                  Reconnect
                </Button>
              </>
            ) : (
              <Button
                plain
                disabled={isPending}
                onClick={() => connectAccount.mutate(provider)}
                className="!text-blue-500 dark:!text-blue-400"
              >
                {isPending ? 'Connecting...' : 'Connect'}
              </Button>
            )}
          </div>
        );
      },
    }),
    [connectAccount],
  );

  const integrationColumns = useMemo(
    () => [
      nameColumn,
      ...createColumnsFromMetadata<BaseRow>(CONNECTION_TABLE_METADATA),
      integrationActionsColumn,
    ],
    [nameColumn, integrationActionsColumn],
  );

  const connectionColumns = useMemo(
    () => [
      nameColumn,
      ...createColumnsFromMetadata<BaseRow>(CONNECTION_TABLE_METADATA),
      connectionActionsColumn,
    ],
    [nameColumn, connectionActionsColumn],
  );

  // -------------------------------------------------------------------------
  // Row data
  // -------------------------------------------------------------------------

  const googleAccount = accounts.find((a) => a.providerId === 'google');
  const ghAppInstalled = ghAppStatus?.installed ?? false;

  const integrationRows: ConnectionRow[] = [
    {
      id: 'github-app',
      name: 'GitHub App',
      icon: <GitHubIcon />,
      status: ghAppInstalled ? 'connected' : 'not-connected',
      connectedBy: ghAppInstalled
        ? ghAppStatus?.installation?.accountLogin
        : undefined,
      connectedAt:
        ghAppInstalled && ghAppStatus?.installation?.installedAt
          ? new Date(ghAppStatus.installation.installedAt)
          : undefined,
    },
    {
      id: 'apollo',
      name: 'Apollo.io',
      icon: <ApolloIcon />,
      status: apolloConnected ? 'connected' : 'not-connected',
      connectedBy: apolloConnected ? apolloStatus?.connectedByEmail : undefined,
      connectedAt:
        apolloConnected && apolloStatus?.connectedAt
          ? new Date(apolloStatus.connectedAt)
          : undefined,
    },
  ];

  const connectionRows: ConnectionRow[] = [
    {
      id: 'google',
      name: 'Google Calendar',
      icon: <GoogleCalendarIcon />,
      status: googleAccount ? 'connected' : 'not-connected',
      connectedBy: googleAccount ? userEmail : undefined,
      connectedAt: googleAccount?.createdAt
        ? new Date(googleAccount.createdAt)
        : undefined,
    },
  ];

  const integrationActiveCount = integrationRows.filter(
    (r) => r.status === 'connected',
  ).length;
  const connectionActiveCount = connectionRows.filter(
    (r) => r.status === 'connected',
  ).length;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <section>
        <div className="mb-2">
          <Subheading>Integrations</Subheading>
          <Text className="mt-1 text-zinc-600 dark:text-zinc-400">
            Install apps to extend functionality.
          </Text>
        </div>
        <BaseTable<BaseRow>
          columns={integrationColumns}
          data={integrationRows}
          loading={loadingApp || loadingApollo}
          entityName="integrations"
          disableRowClick
        />
        <Text className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {integrationActiveCount} of {integrationRows.length} integration
          {integrationRows.length !== 1 ? 's' : ''} active
        </Text>

        {apolloConnected && usageStats && (
          <div className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Apollo API Usage
            </p>
            <div className="grid grid-cols-3 gap-4">
              {usageStats.api_rate_limit_params.map((stat) => {
                const pct = Math.min(
                  100,
                  Math.round((stat.calls_made / stat.calls_limit) * 100),
                );
                const isHigh = pct >= 80;
                return (
                  <div key={stat.duration}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="capitalize text-zinc-600 dark:text-zinc-400">
                        Per {stat.duration}
                      </span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {stat.calls_made.toLocaleString()} /{' '}
                        {stat.calls_limit.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                      <div
                        className={`h-full rounded-full transition-all ${isHigh ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-right text-xs text-zinc-400">
                      {pct}%
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <Divider className="my-10" soft />

      <section>
        <div className="mb-2">
          <Subheading>Connections</Subheading>
          <Text className="mt-1 text-zinc-600 dark:text-zinc-400">
            Connect your accounts for authentication and data access.
          </Text>
        </div>
        <BaseTable<BaseRow>
          columns={connectionColumns}
          data={connectionRows}
          loading={loadingAccounts}
          entityName="connections"
          disableRowClick
        />
        <Text className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {connectionActiveCount} of {connectionRows.length} connection
          {connectionRows.length !== 1 ? 's' : ''} active
        </Text>
      </section>
    </>
  );
};

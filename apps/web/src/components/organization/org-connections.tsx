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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import {
  getGitHubInstallationStatus,
  getGitHubInstallationUrl,
} from '@/server/actions/github';
import type { GitHubInstallationStatus } from '@/lib/api/github';
import {
  getApolloConnectionStatus,
  getApolloAuthorizationUrl,
  disconnectApollo,
} from '@/server/actions/apollo';
import type { ApolloConnectionStatus } from '@/lib/api/apollo';
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

type AccountData = {
  providerId: string;
  createdAt?: string | Date;
};

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

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
// Metadata
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
    header: 'Date/Time',
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
  const userEmail = (session?.data?.user as any)?.email as string | undefined;

  const [ghAppStatus, setGhAppStatus] =
    useState<GitHubInstallationStatus | null>(null);
  const [loadingApp, setLoadingApp] = useState(true);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [apolloStatus, setApolloStatus] =
    useState<ApolloConnectionStatus | null>(null);
  const [loadingApollo, setLoadingApollo] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchAccounts = useCallback(async () => {
    try {
      const result = await authClient.listAccounts();
      const data = (result?.data ?? []) as AccountData[];
      setAccounts(data);
    } catch (e) {
      console.error('Failed to load accounts:', e);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  const fetchApolloStatus = useCallback(async () => {
    try {
      const status = await getApolloConnectionStatus();
      setApolloStatus(status);
    } catch {
      setApolloStatus({ connected: false });
    } finally {
      setLoadingApollo(false);
    }
  }, []);

  useEffect(() => {
    getGitHubInstallationStatus()
      .then((data) => {
        if (data) setGhAppStatus(data);
      })
      .catch(() => setGhAppStatus({ installed: false }))
      .finally(() => setLoadingApp(false));

    fetchAccounts();
    fetchApolloStatus();
  }, [fetchAccounts, fetchApolloStatus]);

  // -------------------------------------------------------------------------
  // Action handlers
  // -------------------------------------------------------------------------

  const handleConnect = useCallback(async (provider: 'google') => {
    setPendingAction(provider);
    try {
      const result = await authClient.linkSocial({
        provider,
        callbackURL: `${window.location.origin}/settings`,
      });
      if (result?.error) {
        toast.error(result.error.message || `Failed to connect ${provider}`);
      }
    } catch (e) {
      console.error('Connection error:', e);
      toast.error(`Failed to connect ${provider}`);
    } finally {
      setPendingAction(null);
    }
  }, []);

  const handleDisconnect = useCallback(
    async (providerId: string) => {
      setPendingAction(`disconnect-${providerId}`);
      try {
        const result = await (authClient as any).unlinkAccount?.({
          providerId,
        });
        if (result?.error) {
          toast.error(
            result.error.message || `Failed to disconnect ${providerId}`,
          );
          return;
        }
        toast.success(`Disconnected ${providerId}`);
        setLoadingAccounts(true);
        await fetchAccounts();
      } catch (e) {
        console.error('Disconnect error:', e);
        toast.error(`Failed to disconnect ${providerId}`);
      } finally {
        setPendingAction(null);
      }
    },
    [fetchAccounts],
  );

  const handleConnectApollo = useCallback(async () => {
    setPendingAction('apollo');
    try {
      const { url } = await getApolloAuthorizationUrl();
      window.location.href = url;
    } catch (e) {
      toast.error('Failed to initiate Apollo connection');
      setPendingAction(null);
    }
  }, []);

  const handleDisconnectApollo = useCallback(async () => {
    setPendingAction('disconnect-apollo');
    try {
      await disconnectApollo();
      toast.success('Apollo disconnected');
      setLoadingApollo(true);
      await fetchApolloStatus();
    } catch (e) {
      toast.error('Failed to disconnect Apollo');
    } finally {
      setPendingAction(null);
    }
  }, [fetchApolloStatus]);

  const handleInstallApp = useCallback(async () => {
    setPendingAction('github-app');
    try {
      const data = await getGitHubInstallationUrl();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error('Could not get GitHub App installation URL');
      }
    } catch (e) {
      console.error('Install error:', e);
      toast.error('Failed to get GitHub App installation URL');
    } finally {
      setPendingAction(null);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Column definitions (inside component so handlers are in scope)
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

  const actionsColumn: ColumnDef<BaseRow> = useMemo(
    () => ({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const { id, status } = row.original as ConnectionRow;
        const connected = status === 'connected';
        const isIntegration = id === 'github-app';
        const provider = id as 'google';
        const isPending =
          pendingAction === id || pendingAction === `disconnect-${id}`;

        if (isIntegration) {
          return (
            <div className="flex items-center gap-1">
              <Button
                plain
                disabled={isPending}
                onClick={handleInstallApp}
                className="!text-blue-500 dark:!text-blue-400"
              >
                {connected ? 'Re-install' : 'Install'}
              </Button>
            </div>
          );
        }

        if (id === 'apollo') {
          return (
            <div className="flex items-center gap-1">
              {connected ? (
                <>
                  <Button
                    plain
                    disabled={pendingAction === 'disconnect-apollo'}
                    onClick={handleDisconnectApollo}
                    className="!text-red-500 dark:!text-red-400"
                  >
                    Disconnect
                  </Button>
                  <Button
                    plain
                    disabled={pendingAction === 'apollo'}
                    onClick={handleConnectApollo}
                    className="!text-blue-500 dark:!text-blue-400"
                  >
                    Reconnect
                  </Button>
                </>
              ) : (
                <Button
                  plain
                  disabled={pendingAction === 'apollo'}
                  onClick={handleConnectApollo}
                  className="!text-blue-500 dark:!text-blue-400"
                >
                  {pendingAction === 'apollo' ? 'Connecting...' : 'Connect'}
                </Button>
              )}
            </div>
          );
        }

        return (
          <div className="flex items-center gap-1">
            {connected ? (
              <>
                <Button
                  plain
                  disabled={pendingAction === `disconnect-${id}`}
                  onClick={() => handleDisconnect(id)}
                  className="!text-red-500 dark:!text-red-400"
                >
                  Disconnect
                </Button>
                <Button
                  plain
                  disabled={pendingAction === provider}
                  onClick={() => handleConnect(provider)}
                  className="!text-blue-500 dark:!text-blue-400"
                >
                  Reconnect
                </Button>
              </>
            ) : (
              <Button
                plain
                disabled={pendingAction === provider}
                onClick={() => handleConnect(provider)}
                className="!text-blue-500 dark:!text-blue-400"
              >
                {pendingAction === provider ? 'Connecting...' : 'Connect'}
              </Button>
            )}
          </div>
        );
      },
    }),
    [pendingAction, handleConnect, handleDisconnect, handleInstallApp],
  );

  const columns = useMemo(
    () => [
      nameColumn,
      ...createColumnsFromMetadata<BaseRow>(CONNECTION_TABLE_METADATA),
      actionsColumn,
    ],
    [nameColumn, actionsColumn],
  );

  // -------------------------------------------------------------------------
  // Row data
  // -------------------------------------------------------------------------

  const googleAccount = accounts.find((a) => a.providerId === 'google');
  const ghAppInstalled = ghAppStatus?.installed ?? false;
  const apolloConnected = apolloStatus?.connected ?? false;

  const integrationRows: ConnectionRow[] = [
    {
      id: 'github-app',
      name: 'GitHub App',
      icon: (
        <Image src="/icons/github.svg" alt="GitHub" width={20} height={20} />
      ),
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

  return (
    <>
      {/* Integrations Section */}
      <section>
        <div className="mb-2">
          <Subheading>Integrations</Subheading>
          <Text className="mt-1 text-zinc-600 dark:text-zinc-400">
            Install apps to extend functionality.
          </Text>
        </div>

        <BaseTable<BaseRow>
          columns={columns}
          data={integrationRows}
          loading={loadingApp || loadingApollo}
          entityName="integrations"
          disableRowClick
        />

        <Text className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {integrationActiveCount} of {integrationRows.length} integration
          {integrationRows.length !== 1 ? 's' : ''} active
        </Text>
      </section>

      <Divider className="my-10" soft />

      {/* Connections Section */}
      <section>
        <div className="mb-2">
          <Subheading>Connections</Subheading>
          <Text className="mt-1 text-zinc-600 dark:text-zinc-400">
            Connect your accounts for authentication and data access.
          </Text>
        </div>

        <BaseTable<BaseRow>
          columns={columns}
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

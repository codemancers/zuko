'use client';

import { Badge, Button, Divider, Subheading, Text } from '@zuko/ui-kit';
import { BaseTable, EMPTY_VALUE } from '@/components/Table';
import { ColumnDef } from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import {
  getGitHubInstallationStatus,
  getGitHubInstallationUrl,
} from '@/server/actions/github';
import type { GitHubInstallationStatus } from '@/lib/api/github';
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

const GitHubIcon = () => (
  <svg
    className="h-5 w-5 text-gray-900 dark:text-gray-100"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const GoogleCalendarIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="18" rx="2" fill="#fff" />
    <rect x="3" y="4" width="18" height="4" rx="2" fill="#EA4335" />
    <rect
      x="3"
      y="4"
      width="18"
      height="18"
      rx="2"
      stroke="#DADCE0"
      strokeWidth="1.5"
      fill="none"
    />
    <path
      d="M8 2v4M16 2v4"
      stroke="#5F6368"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <rect x="7" y="12" width="4" height="4" rx="0.5" fill="#1A73E8" />
    <path
      d="M13 13h4M13 16h2"
      stroke="#5F6368"
      strokeWidth="1"
      strokeLinecap="round"
    />
  </svg>
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(d?: Date): string {
  if (!d) return EMPTY_VALUE;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const OrgConnections = () => {
  const session = authClient.useSession();
  const userEmail = (session?.data?.user as any)?.email as string | undefined;

  const [ghAppStatus, setGhAppStatus] = useState<GitHubInstallationStatus | null>(null);
  const [loadingApp, setLoadingApp] = useState(true);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
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

  useEffect(() => {
    getGitHubInstallationStatus()
      .then((data) => {
        if (data) setGhAppStatus(data);
      })
      .catch(() => setGhAppStatus({ installed: false }))
      .finally(() => setLoadingApp(false));

    fetchAccounts();
  }, [fetchAccounts]);

  // -------------------------------------------------------------------------
  // Action handlers
  // -------------------------------------------------------------------------

  const handleConnect = useCallback(
    async (provider: 'github' | 'google') => {
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
    },
    [],
  );

  const handleDisconnect = useCallback(
    async (providerId: string) => {
      setPendingAction(`disconnect-${providerId}`);
      try {
        const result = await (authClient as any).unlinkAccount?.({ providerId });
        if (result?.error) {
          toast.error(result.error.message || `Failed to disconnect ${providerId}`);
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

  const columns = useMemo(
    (): ColumnDef<ConnectionRow>[] => [
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        size: 220,
        cell: ({ row }) => (
          <div className="flex items-center gap-3 py-0.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
              {row.original.icon}
            </div>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {row.original.name}
            </span>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        size: 130,
        cell: ({ row }) => {
          const connected = row.original.status === 'connected';
          return (
            <Badge color={connected ? 'lime' : 'zinc'}>
              {connected ? 'Connected' : 'Disconnected'}
            </Badge>
          );
        },
      },
      {
        id: 'connectedBy',
        header: 'Connected By',
        accessorKey: 'connectedBy',
        size: 200,
        cell: ({ row }) => (
          <Text className="text-sm text-zinc-600 dark:text-zinc-400">
            {row.original.connectedBy ?? EMPTY_VALUE}
          </Text>
        ),
      },
      {
        id: 'connectedAt',
        header: 'Date/Time',
        accessorKey: 'connectedAt',
        size: 200,
        cell: ({ row }) => (
          <Text className="text-sm text-zinc-600 dark:text-zinc-400">
            {formatDate(row.original.connectedAt)}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 200,
        cell: ({ row }) => {
          const { id, status } = row.original;
          const connected = status === 'connected';
          const isIntegration = id === 'github-app';
          const provider = id as 'github' | 'google';
          const isPending = pendingAction === id || pendingAction === `disconnect-${id}`;

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
      },
    ],
    [pendingAction, handleConnect, handleDisconnect, handleInstallApp],
  );

  // -------------------------------------------------------------------------
  // Row data
  // -------------------------------------------------------------------------

  const ghAccount = accounts.find((a) => a.providerId === 'github');
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
  ];

  const connectionRows: ConnectionRow[] = [
    {
      id: 'github',
      name: 'GitHub',
      icon: <GitHubIcon />,
      status: ghAccount ? 'connected' : 'not-connected',
      connectedBy: ghAccount ? userEmail : undefined,
      connectedAt: ghAccount?.createdAt
        ? new Date(ghAccount.createdAt)
        : undefined,
    },
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

        <BaseTable<ConnectionRow>
          columns={columns}
          data={integrationRows}
          loading={loadingApp}
          entityName="integrations"
          disableRowClick
        />

        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {integrationActiveCount} of {integrationRows.length} integration
          {integrationRows.length !== 1 ? 's' : ''} active
        </p>
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

        <BaseTable<ConnectionRow>
          columns={columns}
          data={connectionRows}
          loading={loadingAccounts}
          entityName="connections"
          disableRowClick
        />

        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {connectionActiveCount} of {connectionRows.length} connection
          {connectionRows.length !== 1 ? 's' : ''} active
        </p>
      </section>
    </>
  );
};

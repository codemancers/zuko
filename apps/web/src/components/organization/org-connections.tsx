'use client';

import {
  Subheading,
  Text,
  Divider,
  Badge,
} from '@zuko/ui-kit';
import { ConnectButton } from '../../app/(app)/settings/connect-button';
import ConnectGitHub from '@/components/Settings/ConnectGitHub';
import InstallGitHubApp from '@/components/Settings/InstallGitHubApp';
import { useEffect, useState } from 'react';

const connections = [
  {
    id: 'google',
    name: 'Google Calendar',
    description: 'Sync events and availability for scheduling.',
    type: 'connection' as const,
  },
] as const;

type ConnectionId = (typeof connections)[number]['id'];

const getConnectionStatus = (accounts: Set<string>, provider: ConnectionId) => {
  if (accounts.has(provider)) {
    return 'connected';
  }
  return 'not-connected';
};

export const OrgConnections = () => {
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/auth/accounts`, {
          credentials: 'include',
        });

        if (response.ok) {
          const accountsData = (await response.json()) as {
            accounts: { providerId: string }[];
          };
          const connectedSet = new Set<string>(
            accountsData.accounts.map((account) => account.providerId),
          );
          setConnectedProviders(connectedSet);
        }
      } catch (error) {
        console.error('Failed to load settings data:', error);
      }
    };

    loadData();
  }, []);

  return (
    <>
      {/* Integrations Section */}
      <section>
        <div className="mb-6">
          <Subheading>Integrations</Subheading>
          <Text className="mt-1 text-zinc-600 dark:text-zinc-400">
            Install apps to extend functionality.
          </Text>
        </div>

        <InstallGitHubApp />
      </section>

      <Divider className="my-10" soft />

      {/* Connections Section */}
      <section>
        <div className="mb-6">
          <Subheading>Connections</Subheading>
          <Text className="mt-1 text-zinc-600 dark:text-zinc-400">
            Connect your accounts for authentication and data access.
          </Text>
        </div>

        <div className="space-y-4">
          <ConnectGitHub />

          {connections.map((connection) => {
            const status = getConnectionStatus(
              connectedProviders,
              connection.id,
            );
            const isConnected = status === 'connected';

            return (
              <div
                key={connection.id}
                className="flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900"
              >
                <div className="flex gap-6">
                  <div className="space-y-1.5">
                    <div className="text-base/6 font-semibold">
                      {connection.name}
                    </div>
                    <div className="text-sm/6 text-zinc-600 dark:text-zinc-400">
                      {connection.description}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge
                    className="max-sm:hidden"
                    color={isConnected ? 'emerald' : 'zinc'}
                  >
                    {isConnected ? 'Connected' : 'Not connected'}
                  </Badge>
                  <ConnectButton
                    provider={connection.id}
                    disabled={isConnected}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
};

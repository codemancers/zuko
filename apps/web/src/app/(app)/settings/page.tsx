'use client';

import { Heading, Subheading, Text, Divider, Badge } from '@zuko/ui-kit';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsPanels,
  TabsContent,
} from '@zuko/ui-kit/lib/tabs';
import { ConnectButton } from './connect-button';
import ConnectGitHub from '@/components/Settings/ConnectGitHub';
import InstallGitHubApp from '@/components/Settings/InstallGitHubApp';
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { OrgTeams } from '@/components/organization/org-teams';
import { OrgMembers } from '@/components/organization/org-members';

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

const SETTINGS_TABS = [
  {
    id: 'connections',
    label: 'Connections',
    heading: 'Settings',
    description: 'Manage your integrations and connected accounts.',
  },
  {
    id: 'teams',
    label: 'Teams',
    heading: 'Teams',
    description: 'Manage your organization teams and members.',
  },
  {
    id: 'members',
    label: 'Members',
    heading: 'Members',
    description: 'Manage who has access to your organization.',
  },
] as const;

export default function SettingsPage() {
  const [activeTab, setActiveTab] =
    useState<(typeof SETTINGS_TABS)[number]['id']>('connections');
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(
    new Set(),
  );
  const activeOrg = authClient.useActiveOrganization();

  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch connected accounts from backend
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/auth/accounts`, {
          credentials: 'include',
        });

        if (response.ok) {
          const accountsData = await response.json();
          const connectedSet = new Set<string>(
            accountsData.accounts.map((account: any) => account.providerId),
          );
          setConnectedProviders(connectedSet);
        }
      } catch (error) {
        console.error('Failed to load settings data:', error);
      }
    };

    loadData();
  }, []);

  const currentTabSpec =
    SETTINGS_TABS.find((tab) => tab.id === activeTab) || SETTINGS_TABS[0];

  return (
    <div className="mx-auto max-w-6xl">
      <Heading>{currentTabSpec.heading}</Heading>
      <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
        {currentTabSpec.description}
      </Text>

      <Tabs
        className="mt-8"
        defaultValue="connections"
        onChange={(index) => {
          // Headless UI TabGroup onChange provides the index
          setActiveTab(SETTINGS_TABS[index as number].id);
        }}
      >
        <TabsList variant="line" className="justify-start">
          {SETTINGS_TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              disabled={tab.id !== 'connections' && !activeOrg.data}
              className={'cursor-pointer'}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsPanels>
          <TabsContent value="connections" className="py-6">
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
          </TabsContent>

          <TabsContent value="teams">
            {activeOrg.data ? (
              <div className="-mt-10">
                <OrgTeams slug={activeOrg.data.slug} hideHeader />
              </div>
            ) : (
              <div className="py-10 text-center text-zinc-500">
                Please select an organization to manage teams.
              </div>
            )}
          </TabsContent>

          <TabsContent value="members">
            {activeOrg.data ? (
              <div className="-mt-10">
                <OrgMembers slug={activeOrg.data.slug} hideHeader />
              </div>
            ) : (
              <div className="py-10 text-center text-zinc-500">
                Please select an organization to manage members.
              </div>
            )}
          </TabsContent>
        </TabsPanels>
      </Tabs>
    </div>
  );
}

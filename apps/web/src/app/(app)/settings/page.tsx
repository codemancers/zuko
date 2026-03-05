'use client';

import {
  Heading,
  Subheading,
  Text,
  Divider,
  Badge,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsPanels,
  TabsContent,
} from '@zuko/ui-kit';
import { ConnectButton } from './connect-button';
import ConnectGitHub from '@/components/Settings/ConnectGitHub';
import InstallGitHubApp from '@/components/Settings/InstallGitHubApp';
import { useEffect, useState, Suspense } from 'react';
import { authClient } from '@/lib/auth-client';
import { OrgTeams } from '@/components/organization/org-teams';
import { OrgMembers } from '@/components/organization/org-members';
import { UserInvitations } from '@/components/organization/user-invitations';
import { AddMemberDialog } from '@/components/organization/add-member-dialog';
import { AddMemberToTeamDialog } from '@/components/organization/add-member-to-team-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserInvitations } from '@/server/query-options';
import { useQueryState, parseAsStringLiteral } from 'nuqs';

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

const ALL_TABS = [
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
  {
    id: 'invitations',
    label: 'Invitations',
    heading: 'Invitations',
    description: 'Accept or decline invitations to organizations.',
  },
] as const;

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-10 text-center text-sm text-zinc-500">
          Loading settings...
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useQueryState(
    'tab',
    parseAsStringLiteral([
      'connections',
      'teams',
      'members',
      'invitations',
    ] as const).withDefault('connections'),
  );

  const { data: invitations = [] } = useQuery(getUserInvitations());

  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(
    new Set(),
  );
  const activeOrg = authClient.useActiveOrganization();

  // Redirect to invitations tab if there are pending invitations
  useEffect(() => {
    if (invitations.length > 0 && currentTab === 'connections') {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('tab')) {
        setCurrentTab('invitations');
      }
    }
  }, [invitations.length, currentTab, setCurrentTab]);

  // Action states
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isAddTeamDialogOpen, setIsAddTeamDialogOpen] = useState(false);

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

  const currentTabSpec =
    ALL_TABS.find((tab) => tab.id === currentTab) || ALL_TABS[0];

  return (
    <div className="mx-auto max-w-6xl">
      <Heading>{currentTabSpec.heading}</Heading>
      <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
        {currentTabSpec.description}
      </Text>

      <Tabs
        className="mt-8"
        selectedIndex={ALL_TABS.findIndex((t) => t.id === currentTab)}
        onChange={(index) => {
          setCurrentTab(ALL_TABS[index as number].id);
        }}
      >
        <div className="flex items-center justify-between border-b border-zinc-950/5 dark:border-white/5">
          <TabsList variant="line" className="border-none!">
            {ALL_TABS.map((tab) => {
              const isInvitations = tab.id === 'invitations';

              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={'cursor-pointer'}
                >
                  {tab.label}
                  {isInvitations && invitations.length > 0 && (
                    <Badge
                      color="blue"
                      className="ml-2 px-1.5 py-0 text-[10px]"
                    >
                      {invitations.length}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="flex items-center gap-3">
            {currentTab === 'members' && (
              <>
                <Button onClick={() => setIsInviteDialogOpen(true)}>
                  Invite to Org
                </Button>
              </>
            )}
            {currentTab === 'teams' && (
              <Button href={`/organization/${activeOrg.data?.slug}/teams/new`}>
                Create Team
              </Button>
            )}
          </div>
        </div>

        <TabsPanels>
          {ALL_TABS.map((tab) => {
            return (
              <TabsContent key={tab.id} value={tab.id} className="py-6">
                {tab.id === 'invitations' && <UserInvitations />}

                {tab.id === 'connections' && (
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
                          Connect your accounts for authentication and data
                          access.
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
                )}

                {tab.id === 'teams' && (
                  <>
                    {activeOrg.data ? (
                      <div className="-mt-10">
                        <OrgTeams slug={activeOrg.data.slug} hideHeader />
                      </div>
                    ) : (
                      <div className="py-10 text-center text-zinc-500">
                        Please select an organization to manage teams.
                      </div>
                    )}
                  </>
                )}

                {tab.id === 'members' && (
                  <>
                    {activeOrg.data ? (
                      <div className="-mt-10">
                        <OrgMembers slug={activeOrg.data.slug} hideHeader />
                      </div>
                    ) : (
                      <div className="py-10 text-center text-zinc-500">
                        Please select an organization to manage members.
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            );
          })}
        </TabsPanels>
      </Tabs>

      {activeOrg.data && (
        <>
          <AddMemberDialog
            organizationId={activeOrg.data.id}
            isOpen={isInviteDialogOpen}
            onClose={() => setIsInviteDialogOpen(false)}
            onSuccess={() => {
              queryClient.invalidateQueries({
                queryKey: ['organization', activeOrg.data?.id, 'members'],
              });
              queryClient.invalidateQueries({
                queryKey: ['organization', activeOrg.data?.id, 'invitations'],
              });
            }}
          />
          <AddMemberToTeamDialog
            organizationId={activeOrg.data.id}
            userId=""
            memberName=""
            isOpen={isAddTeamDialogOpen}
            onClose={() => setIsAddTeamDialogOpen(false)}
            onSuccess={() => {
              queryClient.invalidateQueries({
                queryKey: ['organization', activeOrg.data?.id, 'teams'],
              });
              queryClient.invalidateQueries({
                queryKey: ['team'],
              });
            }}
          />
        </>
      )}
    </div>
  );
}

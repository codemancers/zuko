'use client';

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsPanels,
  TabsContent,
  Badge,
  Button,
} from '@zuko/ui-kit';
import { useEffect, Suspense, useState } from 'react';
import { AddMemberDialog } from '@/components/organization/add-member-dialog';
import { CreateTeamDialog } from '@/components/organization/create-team-dialog';
import { PageHeader } from '@/components/shared';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { OrgTeams } from '@/components/organization/org-teams';
import { OrgMembers } from '@/components/organization/org-members';
import { UserInvitations } from '@/components/organization/user-invitations';
import { OrgConnections } from '@/components/organization/org-connections';
import { getUserInvitations } from '@/server/query-options';
import { useQueryState, parseAsStringLiteral } from 'nuqs';

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
  const activeOrg = authClient.useActiveOrganization();
  const queryClient = useQueryClient();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);

  // Redirect to invitations tab if there are pending invitations
  useEffect(() => {
    if (invitations.length > 0 && currentTab === 'connections') {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('tab')) {
        setCurrentTab('invitations');
      }
    }
  }, [invitations.length, currentTab, setCurrentTab]);

  const currentTabSpec =
    ALL_TABS.find((tab) => tab.id === currentTab) || ALL_TABS[0];

  return (
    <>
      <PageHeader
        title={currentTabSpec.heading}
        description={currentTabSpec.description}
        action={
          currentTab === 'members' ? (
            <Button onClick={() => setIsInviteDialogOpen(true)}>
              Invite to Org
            </Button>
          ) : currentTab === 'teams' ? (
            <Button onClick={() => setIsCreateTeamDialogOpen(true)}>
              Create Team
            </Button>
          ) : undefined
        }
      />

      <Tabs
        className="mt-8"
        selectedIndex={ALL_TABS.findIndex((t) => t.id === currentTab)}
        onChange={(index) => {
          setCurrentTab(ALL_TABS[index as number].id);
        }}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10">
          <TabsList variant="line">
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
                    <Badge color="blue" className="ml-2 px-1.5 py-0 text-xs">
                      {invitations.length}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsPanels>
          {ALL_TABS.map((tab) => {
            return (
              <TabsContent key={tab.id} value={tab.id} className="py-6">
                {tab.id === 'invitations' && (
                  <div className="-mt-10">
                    <UserInvitations />
                  </div>
                )}

                {tab.id === 'connections' && (
                  <div className="-mt-10">
                    <OrgConnections />
                  </div>
                )}

                {tab.id === 'teams' && (
                  <div className="-mt-10">
                    <OrgTeams slug={activeOrg.data?.slug ?? ''} hideHeader />
                  </div>
                )}

                {tab.id === 'members' && (
                  <div className="-mt-10">
                    <OrgMembers slug={activeOrg.data?.slug ?? ''} hideHeader />
                  </div>
                )}
              </TabsContent>
            );
          })}
        </TabsPanels>
      </Tabs>

      <AddMemberDialog
        organizationId={activeOrg.data?.id ?? ''}
        isOpen={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ['organization', activeOrg.data?.id, 'invitations'],
          });
        }}
      />

      <CreateTeamDialog
        organizationId={activeOrg.data?.id ?? ''}
        isOpen={isCreateTeamDialogOpen}
        onClose={() => setIsCreateTeamDialogOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ['organization', activeOrg.data?.id, 'teams'],
          });
        }}
      />
    </>
  );
}

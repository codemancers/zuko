'use client';

import {
  Heading,
  Text,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsPanels,
  TabsContent,
  Alert,
  AlertActions,
  AlertDescription,
  AlertTitle,
  Badge,
} from '@zuko/ui-kit';
import { useEffect, useState, Suspense } from 'react';
import { authClient } from '@/lib/auth-client';
import { OrgTeams } from '@/components/organization/org-teams';
import { OrgMembers } from '@/components/organization/org-members';
import { UserInvitations } from '@/components/organization/user-invitations';
import { OrgConnections } from '@/components/organization/org-connections';
import { AddMemberDialog } from '@/components/organization/add-member-dialog';
import { AddMemberToTeamDialog } from '@/components/organization/add-member-to-team-dialog';
import { CreateTeamDialog } from '@/components/organization/create-team-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserInvitations } from '@/server/query-options';
import { useQueryState, parseAsStringLiteral } from 'nuqs';
import { toast } from 'sonner';

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
  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
  const [teamToRemove, setTeamToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleRemoveTeam = async () => {
    if (!teamToRemove || !activeOrg.data) return;

    try {
      const { error } = await authClient.organization.removeTeam({
        teamId: teamToRemove.id,
        organizationId: activeOrg.data.id,
      });

      if (error) {
        toast.error(error.message || 'Failed to remove team');
        return;
      }

      toast.success(`Team "${teamToRemove.name}" removed`);
      queryClient.invalidateQueries({
        queryKey: ['organization', activeOrg.data.id, 'teams'],
      });
    } catch {
      toast.error('An error occurred');
    } finally {
      setTeamToRemove(null);
    }
  };

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

          <div className="flex items-center gap-3">
            {currentTab === 'members' && (
              <>
                <Button onClick={() => setIsInviteDialogOpen(true)}>
                  Invite to Org
                </Button>
              </>
            )}
            {currentTab === 'teams' && (
              <Button onClick={() => setIsCreateTeamDialogOpen(true)}>
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

                {tab.id === 'connections' && <OrgConnections />}

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
          <CreateTeamDialog
            organizationId={activeOrg.data.id}
            isOpen={isCreateTeamDialogOpen}
            onClose={() => setIsCreateTeamDialogOpen(false)}
            onSuccess={() => {
              queryClient.invalidateQueries({
                queryKey: ['organization', activeOrg.data?.id, 'teams'],
              });
            }}
          />

          <Alert open={!!teamToRemove} onClose={() => setTeamToRemove(null)}>
            <AlertTitle>Remove Team</AlertTitle>
            <AlertDescription>
              Are you sure you want to remove the team "{teamToRemove?.name}"?
              This will not remove members from the organization.
            </AlertDescription>
            <AlertActions>
              <Button plain onClick={() => setTeamToRemove(null)}>
                Cancel
              </Button>
              <Button color="red" onClick={handleRemoveTeam}>
                Remove
              </Button>
            </AlertActions>
          </Alert>
        </>
      )}
    </div>
  );
}

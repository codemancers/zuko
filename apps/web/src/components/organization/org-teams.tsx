'use client';

import {
  Heading,
  Button,
  Avatar,
  Link,
  Text,
  Alert,
  AlertActions,
  AlertDescription,
  AlertTitle,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@zuko/ui-kit';
import { ChevronLeftIcon } from '@heroicons/react/20/solid';
import { TableActions, DeleteAction } from '../Table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getOrganizations,
  getTeams,
  getTeamMembers,
  getMembers,
} from '@/server/query-options';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { BaseTable } from '../Table';
import { createTeamColumns, OrgTeam } from './team-columns';

export const OrgTeams = ({
  slug,
  hideHeader = false,
}: {
  slug: string;
  hideHeader?: boolean;
}) => {
  const queryClient = useQueryClient();
  const [teamToRemove, setTeamToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data: organizations, isLoading: isLoadingOrgs } =
    useQuery(getOrganizations());
  const activeOrg = organizations?.find((o) => o.slug === slug);

  const { data: teams = [], isLoading: isLoadingTeams } = useQuery({
    ...getTeams(activeOrg?.id || ''),
    enabled: !!activeOrg?.id,
  });

  const handleRemoveTeam = async () => {
    if (!teamToRemove || !activeOrg) return;

    try {
      const { error } = await authClient.organization.removeTeam({
        teamId: teamToRemove.id,
        organizationId: activeOrg.id,
      });

      if (error) {
        toast.error(error.message || 'Failed to remove team');
        return;
      }

      toast.success(`Team "${teamToRemove.name}" removed`);
      queryClient.invalidateQueries({
        queryKey: ['organization', activeOrg.id, 'teams'],
      });
    } catch {
      toast.error('An error occurred');
    } finally {
      setTeamToRemove(null);
    }
  };

  const handleAddTeam = async () => {
    if (!activeOrg) return;
    try {
      const { error } = await authClient.organization.createTeam({
        name: 'New Team',
        organizationId: activeOrg.id,
      });
      if (error) { toast.error(error.message || 'Failed to create team'); return; }
      toast.success('Team created');
      queryClient.invalidateQueries({ queryKey: ['organization', activeOrg.id, 'teams'] });
    } catch {
      toast.error('An error occurred');
    }
  };

  const handleRenameTeam = async (team: { id: string; name: string }, newName: string) => {
    if (!activeOrg) return;
    try {
      const { error } = await authClient.organization.updateTeam({
        teamId: team.id,
        data: { name: newName },
      });
      if (error) { toast.error(error.message || 'Failed to rename team'); return; }
      toast.success(`Team renamed to "${newName}"`);
      queryClient.invalidateQueries({ queryKey: ['organization', activeOrg.id, 'teams'] });
    } catch {
      toast.error('An error occurred');
    }
  };

  const isLoading = isLoadingOrgs || (!!activeOrg && isLoadingTeams);

  return (
    <div>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-10">
          <Link
            href={`/organization/${slug}`}
            className="inline-flex items-center gap-2 text-sm/6 text-zinc-500 dark:text-zinc-400"
          >
            <ChevronLeftIcon className="size-4 fill-zinc-400 dark:fill-zinc-500" />
            Back to {activeOrg?.name}
          </Link>
        </div>
      )}

      {!hideHeader && (
        <div className="flex items-center justify-between mb-8">
          <div>
            <Heading>Teams</Heading>
            <Text className="mt-1">Manage teams within {activeOrg?.name}.</Text>
          </div>
        </div>
      )}

      <BaseTable
        columns={createTeamColumns({
          onRename: handleRenameTeam,
          renderMembersCell: (team: OrgTeam) =>
            activeOrg ? (
              <TeamMemberAvatars
                teamId={team.id}
                organizationId={activeOrg.id}
              />
            ) : null,
          renderActionsCell: (team: OrgTeam) =>
            activeOrg ? (
              <TableActions>
                <DeleteAction onClick={() => setTeamToRemove(team)} label="Remove team" />
              </TableActions>
            ) : null,
        })}
        data={teams}
        loading={isLoading}
        entityName="teams"
        disableRowClick
        showAddRow
        onAddRow={handleAddTeam}
        showEmptyState={false}
      />

      <Alert open={!!teamToRemove} onClose={() => setTeamToRemove(null)}>
        <AlertTitle>Remove Team</AlertTitle>
        <AlertDescription>
          Are you sure you want to remove the team "{teamToRemove?.name}"? This
          will not remove members from the organization.
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
    </div>
  );
};

// Sub-component to fetch and render team member avatars
const TeamMemberAvatars = ({
  teamId,
  organizationId,
}: {
  teamId: string;
  organizationId: string;
}) => {
  const { data: teamMembers = [] } = useQuery(getTeamMembers(teamId));
  const { data: orgMembers = [] } = useQuery(getMembers(organizationId));

  const enriched = teamMembers
    .map((tm) => orgMembers.find((m) => m.user.id === tm.userId))
    .filter(Boolean) as (typeof orgMembers)[number][];

  if (enriched.length === 0) {
    return <span className="text-xs text-zinc-400 italic">No members yet</span>;
  }

  const visible = enriched.slice(0, 5);
  const overflow = enriched.length - visible.length;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center -space-x-2">
          {visible.map((member) => {
            const nameToUse = member.user.name || member.user.email || '?';
            return (
              <Tooltip key={member.id}>
                <TooltipTrigger asChild>
                  <Avatar
                    src={member.user.image}
                    initials={nameToUse
                      .split(/[\s.@]+/)
                      .filter(Boolean)
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                    className="size-6 bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 ring-1 ring-white dark:ring-zinc-900"
                  />
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>
                  <p>{nameToUse}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
          {overflow > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="size-6 rounded-full bg-zinc-200 dark:bg-zinc-700 ring-1 ring-white dark:ring-zinc-900 flex items-center justify-center text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  +{overflow}
                </div>
              </TooltipTrigger>
              <TooltipContent sideOffset={4}>
                <p>
                  {overflow} more member{overflow === 1 ? '' : 's'}
                </p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

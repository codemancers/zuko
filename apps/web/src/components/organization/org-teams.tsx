'use client';

import {
  Heading,
  Avatar,
  Link,
  Text,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@zuko/ui-kit';
import { ChevronLeftIcon } from '@heroicons/react/20/solid';
import {
  TableActions,
  DeleteAction,
  createColumnsFromMetadata,
  type BaseRow,
} from '../Table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getOrganizations,
  getTeams,
  getTeamMembers,
  getMembers,
} from '@/server/query-options';
import { useMemo, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { BaseTable } from '../Table';
import type { ColumnDef } from '@tanstack/react-table';
import { TEAM_TABLE_METADATA, type OrgTeam } from './team-columns';
import { ConfirmDialog } from '@/components/shared';

export const OrgTeams = ({
  slug,
  hideHeader = false,
}: {
  slug: string;
  hideHeader?: boolean;
}) => {
  const queryClient = useQueryClient();
  const [teamToRemove, setTeamToRemove] = useState<OrgTeam | null>(null);

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
      if (error) {
        toast.error(error.message || 'Failed to create team');
        return;
      }
      toast.success('Team created');
      queryClient.invalidateQueries({
        queryKey: ['organization', activeOrg.id, 'teams'],
      });
    } catch {
      toast.error('An error occurred');
    }
  };

  const handleRenameTeam = async (teamId: string, newName: string) => {
    if (!activeOrg) return;
    try {
      const { error } = await authClient.organization.updateTeam({
        teamId,
        data: { name: newName },
      });
      if (error) {
        toast.error(error.message || 'Failed to rename team');
        return;
      }
      toast.success(`Team renamed to "${newName}"`);
      queryClient.invalidateQueries({
        queryKey: ['organization', activeOrg.id, 'teams'],
      });
    } catch {
      toast.error('An error occurred');
    }
  };

  const membersColumn: ColumnDef<BaseRow> = useMemo(
    () => ({
      id: 'members',
      header: 'Members',
      cell: ({ row }) =>
        activeOrg ? (
          <TeamMemberAvatars
            teamId={String(row.original.id)}
            organizationId={activeOrg.id}
          />
        ) : null,
    }),
    [activeOrg],
  );

  const actionsColumn: ColumnDef<BaseRow> = useMemo(
    () => ({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <TableActions>
          <DeleteAction
            onClick={() => setTeamToRemove(row.original as OrgTeam)}
            label="Remove team"
          />
        </TableActions>
      ),
    }),
    [],
  );

  const columns = useMemo(
    () =>
      createColumnsFromMetadata<BaseRow>(TEAM_TABLE_METADATA)
        .concat(membersColumn)
        .concat(actionsColumn),
    [membersColumn, actionsColumn],
  );

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
        columns={columns}
        data={teams}
        loading={isLoading}
        entityName="teams"
        disableRowClick
        onCellUpdate={(rowId, columnId, value) => {
          if (columnId === 'name') {
            handleRenameTeam(String(rowId), value as string);
          }
        }}
        showAddRow
        onAddRow={handleAddTeam}
        showEmptyState={false}
      />

      <ConfirmDialog
        open={!!teamToRemove}
        onClose={() => setTeamToRemove(null)}
        onConfirm={handleRemoveTeam}
        title="Remove Team"
        description={`Are you sure you want to remove the team "${teamToRemove?.name}"? This will not remove members from the organization.`}
        confirmText="Remove"
        confirmColor="red"
      />
    </div>
  );
};

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

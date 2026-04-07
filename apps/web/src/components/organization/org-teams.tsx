'use client';

import {
  Heading,
  Button,
  Avatar,
  Link,
  Text,
  Input,
  Alert,
  AlertActions,
  AlertDescription,
  AlertTitle,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  TableRow,
  TableCell,
} from '@zuko/ui-kit';
import { ChevronLeftIcon } from '@heroicons/react/20/solid';
import { UserGroupIcon } from '@heroicons/react/24/outline';
import { TableActions, EditAction, DeleteAction } from '../Table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getOrganizations,
  getTeams,
  getTeamMembers,
  getMembers,
} from '@/server/query-options';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { CreateTeamDialog } from './create-team-dialog';
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const newTeamInputRef = useRef<HTMLInputElement>(null);
  const [teamToEdit, setTeamToEdit] = useState<{
    id: string;
    name: string;
  } | null>(null);
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

  const handleSaveNewTeam = async () => {
    if (!newTeamName.trim() || !activeOrg) return;
    setIsSaving(true);
    try {
      const { error } = await authClient.organization.createTeam({
        name: newTeamName.trim(),
        organizationId: activeOrg.id,
      });
      if (error) {
        toast.error(error.message || 'Failed to create team');
        return;
      }
      toast.success(`Team "${newTeamName.trim()}" created`);
      queryClient.invalidateQueries({
        queryKey: ['organization', activeOrg.id, 'teams'],
      });
      setNewTeamName('');
      setIsAddingRow(false);
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelNewTeam = () => {
    setNewTeamName('');
    setIsAddingRow(false);
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
            Back to {activeOrg.name}
          </Link>
        </div>
      )}

      {!hideHeader && (
        <div className="flex items-center justify-between mb-8">
          <div>
            <Heading>Teams</Heading>
            <Text className="mt-1">Manage teams within {activeOrg.name}.</Text>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            Create Team
          </Button>
        </div>
      )}

      <BaseTable
        columns={createTeamColumns({
          renderMembersCell: (team: OrgTeam) =>
            activeOrg ? (
              <TeamMemberAvatars
                teamId={team.id}
                organizationId={activeOrg.id}
              />
            ) : null,
          renderActionsCell: (team: OrgTeam) =>
            activeOrg ? (
              <div className="flex justify-end pr-2">
                <TeamActions
                  onEdit={() => setTeamToEdit(team)}
                  onRemove={() => setTeamToRemove(team)}
                />
              </div>
            ) : null,
        })}
        data={teams}
        loading={isLoading}
        entityName="teams"
        disableRowClick
        showAddRow={!isAddingRow}
        onAddRow={() => {
          setIsAddingRow(true);
          setTimeout(() => newTeamInputRef.current?.focus(), 0);
        }}
        addRowContent={
          isAddingRow ? (
            <TableRow
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  handleCancelNewTeam();
                }
              }}
            >
              {/* sno */}
              <TableCell className="w-16 align-middle" />
              {/* team name input */}
              <TableCell className="align-middle py-2">
                <Input
                  ref={newTeamInputRef}
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Team name"
                  disabled={isSaving}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNewTeam();
                    if (e.key === 'Escape') handleCancelNewTeam();
                  }}
                />
              </TableCell>
              {/* members — empty */}
              <TableCell className="align-middle" />
              {/* actions */}
              <TableCell className="align-middle">
                <div className="flex items-center justify-end gap-2 pr-2">
                  <Button
                    onClick={handleSaveNewTeam}
                    disabled={isSaving || !newTeamName.trim()}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button plain onClick={handleCancelNewTeam} disabled={isSaving}>
                    Cancel
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ) : null
        }
        showEmptyState={true}
        emptyStateConfig={{
          icon: UserGroupIcon,
          title: 'No teams found',
          description: 'Create a team to organize members in your organization.',
          action: {
            label: 'Create Team',
            onClick: () => {
              setIsAddingRow(true);
              setTimeout(() => newTeamInputRef.current?.focus(), 0);
            },
          },
        }}
      />

      <CreateTeamDialog
        organizationId={activeOrg?.id ?? ''}
        isOpen={!!activeOrg && (isCreateDialogOpen || !!teamToEdit)}
        onClose={() => {
          setIsCreateDialogOpen(false);
          setTeamToEdit(null);
        }}
        initialData={teamToEdit || undefined}
        onSuccess={() => {
          if (!teamToEdit) {
            router.push('/settings?tab=teams');
            router.refresh();
          }
        }}
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

const TeamActions = ({
  onEdit,
  onRemove,
}: {
  onEdit: () => void;
  onRemove: () => void;
}) => (
  <TableActions>
    <EditAction onClick={onEdit} label="Edit team" />
    <DeleteAction onClick={onRemove} label="Remove team" />
  </TableActions>
);

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

'use client';

import {
  Heading,
  Divider,
  Button,
  Avatar,
  Link,
  Text,
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
  Alert,
  AlertActions,
  AlertDescription,
  AlertTitle,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@zuko/ui-kit';
import {
  ChevronLeftIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/20/solid';
import { useQuery, useQueryClient, useQueries } from '@tanstack/react-query';
import {
  getOrganizations,
  getMembers,
  getInvitations,
  getTeams,
  getTeamMembers,
} from '@/server/query-options';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { useState } from 'react';
import { AddMemberDialog } from './add-member-dialog';
import { AddMemberToTeamDialog } from './add-member-to-team-dialog';
import { RemoveFromTeamsDialog } from './remove-from-teams-dialog';

export const OrgMembers = ({
  slug,
  hideHeader = false,
}: {
  slug: string;
  hideHeader?: boolean;
}) => {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addToTeamTarget, setAddToTeamTarget] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [removeFromTeamsTarget, setRemoveFromTeamsTarget] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data: organizations, isLoading: isLoadingOrgs } =
    useQuery(getOrganizations());
  const activeOrg = organizations?.find((o) => o.slug === slug);

  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    ...getMembers(activeOrg?.id || ''),
    enabled: !!activeOrg?.id,
  });

  const { data: allInvitations = [], isLoading: isLoadingInvitations } =
    useQuery({
      ...getInvitations(activeOrg?.id || ''),
      enabled: !!activeOrg?.id,
    });

  const invitations = allInvitations.filter((i) => i.status === 'pending');

  const handleRemoveMember = async () => {
    if (!memberToRemove || !activeOrg) return;

    try {
      const { error } = await authClient.organization.removeMember({
        memberIdOrEmail: memberToRemove.id,
        organizationId: activeOrg.id,
      });

      if (error) {
        toast.error(error.message || 'Failed to remove member');
        return;
      }

      toast.success('Member removed');
      queryClient.invalidateQueries({
        queryKey: ['organization', activeOrg.id, 'members'],
      });
    } catch {
      toast.error('An error occurred');
    } finally {
      setMemberToRemove(null);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!activeOrg) return;

    try {
      const { error } = await authClient.organization.cancelInvitation({
        invitationId,
      });

      if (error) {
        toast.error(error.message || 'Failed to cancel invitation');
        return;
      }

      toast.success('Invitation cancelled');
      queryClient.invalidateQueries({
        queryKey: ['organization', activeOrg.id, 'invitations'],
      });
    } catch {
      toast.error('An error occurred');
    }
  };

  const isLoading =
    isLoadingOrgs ||
    (!!activeOrg && (isLoadingMembers || isLoadingInvitations));

  if (isLoading) {
    return (
      <div className="p-8 text-center text-zinc-500">Loading members...</div>
    );
  }

  if (!activeOrg) {
    return (
      <div className="p-8 text-center text-red-500">
        Organization not found.
      </div>
    );
  }

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
            <Heading>Members</Heading>
            <Text className="mt-1">
              Manage who has access to {activeOrg.name}.
            </Text>
          </div>
          <div className="flex items-center gap-3">
            <Button outline onClick={() => setIsAddDialogOpen(true)}>
              Invite to Org
            </Button>
            <Button
              onClick={() => setAddToTeamTarget({ userId: '', name: '' })}
            >
              Add to Team
            </Button>
          </div>
        </div>
      )}

      <Table className="mt-10 [--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
        <TableHead>
          <TableRow>
            <TableHeader>Member</TableHeader>
            <TableHeader>Role</TableHeader>
            <TableHeader>Teams</TableHeader>
            <TableHeader className="text-right">Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {members.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="py-12 text-center text-zinc-500"
              >
                No members found.
              </TableCell>
            </TableRow>
          ) : (
            members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-4">
                    <Avatar
                      src={member.user.image}
                      initials={member.user.name
                        ?.split(' ')
                        .map((n: string) => n[0])
                        .join('')}
                      square
                      className="size-10 shadow-sm"
                    />
                    <div className="flex flex-col">
                      <Link
                        href={`/organization/${slug}/members/${member.id}`}
                        className="text-sm font-medium text-zinc-950 dark:text-white hover:text-blue-600 transition-colors"
                      >
                        {member.user.name || member.user.email}
                      </Link>
                      <span className="text-xs text-zinc-500 mt-0.5">
                        {member.user.email}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge color={member.role === 'owner' ? 'red' : 'blue'}>
                    {member.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <MemberTeamBadges
                    userId={member.user.id}
                    organizationId={activeOrg.id}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end pr-2">
                    <MemberDropdownMenu
                      member={member}
                      organizationId={activeOrg.id}
                      slug={slug}
                      onAddToTeam={() =>
                        setAddToTeamTarget({
                          userId: member.user.id,
                          name: member.user.name || member.user.email,
                        })
                      }
                      onRemoveFromTeams={() =>
                        setRemoveFromTeamsTarget({
                          userId: member.user.id,
                          name: member.user.name || member.user.email,
                        })
                      }
                      onRemoveMember={() =>
                        setMemberToRemove({
                          id: member.id,
                          name: member.user.name || member.user.email,
                        })
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {invitations.length > 0 && (
        <div className="mt-16">
          <Heading level={3}>Pending Invitations</Heading>
          <Text className="mt-1">
            People who have been invited but haven't joined yet.
          </Text>
          <ul className="mt-8">
            {invitations.map((invitation, index) => (
              <li key={invitation.id}>
                <Divider soft={index > 0} />
                <div className="flex items-center justify-between py-6">
                  <div className="flex flex-col gap-1">
                    <div className="text-base/6 font-semibold text-zinc-950 dark:text-white">
                      {invitation.email}
                    </div>
                    <div className="text-xs/6 text-zinc-500 flex items-center gap-1.5">
                      <span className="capitalize">{invitation.role}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-blue-600 dark:text-blue-400">
                        {invitation.status}
                      </span>
                    </div>
                  </div>
                  <Button
                    plain
                    onClick={() => handleCancelInvitation(invitation.id)}
                    className="text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400"
                  >
                    Cancel
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AddMemberDialog
        organizationId={activeOrg.id}
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ['organization', activeOrg.id, 'members'],
          });
          queryClient.invalidateQueries({
            queryKey: ['organization', activeOrg.id, 'invitations'],
          });
        }}
      />

      {addToTeamTarget !== null && (
        <AddMemberToTeamDialog
          organizationId={activeOrg.id}
          userId={addToTeamTarget.userId}
          memberName={addToTeamTarget.name}
          isOpen={addToTeamTarget !== null}
          onClose={() => setAddToTeamTarget(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({
              queryKey: ['organization', activeOrg.id, 'teams'],
            });
            queryClient.invalidateQueries({
              queryKey: ['team'],
            });
          }}
        />
      )}

      {removeFromTeamsTarget !== null && (
        <RemoveFromTeamsDialog
          organizationId={activeOrg.id}
          userId={removeFromTeamsTarget.userId}
          memberName={removeFromTeamsTarget.name}
          isOpen={removeFromTeamsTarget !== null}
          onClose={() => setRemoveFromTeamsTarget(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({
              queryKey: ['organization', activeOrg.id, 'teams'],
            });
            queryClient.invalidateQueries({
              queryKey: ['team'],
            });
          }}
        />
      )}

      <Alert open={!!memberToRemove} onClose={() => setMemberToRemove(null)}>
        <AlertTitle>Remove Member</AlertTitle>
        <AlertDescription>
          Are you sure you want to remove {memberToRemove?.name} from the
          organization? They will lose all access.
        </AlertDescription>
        <AlertActions>
          <Button plain onClick={() => setMemberToRemove(null)}>
            Cancel
          </Button>
          <Button color="red" onClick={handleRemoveMember}>
            Remove
          </Button>
        </AlertActions>
      </Alert>
    </div>
  );
};
// Sub-component to show which teams a member belongs to
const MemberTeamBadges = ({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId: string;
}) => {
  const { data: teams = [] } = useQuery(getTeams(organizationId));

  const teamMemberResults = useQueries({
    queries: teams.map((team) => ({
      ...getTeamMembers(team.id),
    })),
  });

  const memberTeams = teams.filter((_, i) =>
    teamMemberResults[i].data?.some((tm) => tm.userId === userId),
  );

  if (memberTeams.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {memberTeams.map((team) => (
        <Badge color="fuchsia">{team.name}</Badge>
      ))}
    </div>
  );
};

const MemberDropdownMenu = ({
  member,
  organizationId,
  slug,
  onAddToTeam,
  onRemoveFromTeams,
  onRemoveMember,
}: {
  member: {
    id: string;
    role: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      image?: string | null;
    };
  };
  organizationId: string;
  slug: string;
  onAddToTeam: () => void;
  onRemoveFromTeams: () => void;
  onRemoveMember: () => void;
}) => {
  return (
    <Dropdown>
      <DropdownButton plain aria-label="More options">
        <EllipsisVerticalIcon className="size-5" />
      </DropdownButton>
      <DropdownMenu>
        <DropdownItem onClick={onAddToTeam}>Add to Team</DropdownItem>
        <DropdownItem onClick={onRemoveFromTeams}>
          Remove from Teams
        </DropdownItem>
        <DropdownItem onClick={onRemoveMember}>
          <span className="text-red-600 dark:text-red-500">Remove Member</span>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};

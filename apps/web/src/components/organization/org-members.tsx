'use client';

import {
  Heading,
  Button,
  Link,
  Text,
  Input,
  Select,
  Alert,
  AlertActions,
  AlertDescription,
  AlertTitle,
  TableRow,
  TableCell,
} from '@zuko/ui-kit';
import { ChevronLeftIcon } from '@heroicons/react/20/solid';
import { UsersIcon } from '@heroicons/react/24/outline';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getOrganizations,
  getMembers,
  getInvitations,
  getTeams,
} from '@/server/query-options';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { useMemo, useRef, useState } from 'react';
import { BaseTable } from '../Table';
import { createMemberColumns, type MemberTableRow } from './member-columns';

const ROLES = ['owner', 'admin', 'member'] as const;

export const OrgMembers = ({
  slug,
  hideHeader = false,
}: {
  slug: string;
  hideHeader?: boolean;
}) => {
  const queryClient = useQueryClient();

  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'owner' | 'admin' | 'member'>('member');
  const [isSaving, setIsSaving] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const [memberToRemove, setMemberToRemove] = useState<MemberTableRow | null>(null);

  const { data: organizations, isLoading: isLoadingOrgs } =
    useQuery(getOrganizations());
  const activeOrg = organizations?.find((o) => o.slug === slug);

  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    ...getMembers(activeOrg?.id || ''),
    enabled: !!activeOrg?.id,
  });

  const { data: allInvitations = [], isLoading: isLoadingInvitations } = useQuery({
    ...getInvitations(activeOrg?.id || ''),
    enabled: !!activeOrg?.id,
  });

  const { data: teams = [] } = useQuery({
    ...getTeams(activeOrg?.id || ''),
    enabled: !!activeOrg?.id,
  });

  const pendingInvitations = allInvitations.filter((i) => i.status === 'pending');

  // -------------------------------------------------------------------------
  // Unified rows: active members + pending invitations
  // -------------------------------------------------------------------------

  const rows = useMemo((): MemberTableRow[] => {
    const memberRows: MemberTableRow[] = members.map((m: any) => ({
      id: m.id,
      type: 'member' as const,
      name: m.user?.name || m.user?.email || '—',
      email: m.user?.email || '—',
      role: m.role,
      status: 'active' as const,
      joinedAt: m.createdAt ? new Date(m.createdAt) : undefined,
      memberId: m.id,
      userId: m.userId,
    }));

    const invitationRows: MemberTableRow[] = pendingInvitations.map((inv: any) => ({
      id: `inv-${inv.id}`,
      type: 'invitation' as const,
      name: inv.email,
      email: inv.email,
      role: inv.role,
      status: 'invited' as const,
      joinedAt: undefined,
      invitationId: inv.id,
    }));

    return [...memberRows, ...invitationRows];
  }, [members, pendingInvitations]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleRoleChange = async (row: MemberTableRow, role: string) => {
    if (!activeOrg || row.type !== 'member' || !row.memberId) return;
    try {
      const { error } = await authClient.organization.updateMemberRole({
        memberId: row.memberId,
        role: role as any,
        organizationId: activeOrg.id,
      });
      if (error) {
        toast.error(error.message || 'Failed to update role');
        return;
      }
      toast.success('Role updated');
      queryClient.invalidateQueries({
        queryKey: ['organization', activeOrg.id, 'members'],
      });
    } catch {
      toast.error('An error occurred');
    }
  };

  const handleRemove = (row: MemberTableRow) => {
    setMemberToRemove(row);
  };

  const confirmRemove = async () => {
    if (!memberToRemove || !activeOrg) return;
    try {
      if (memberToRemove.type === 'member' && memberToRemove.memberId) {
        const { error } = await authClient.organization.removeMember({
          memberIdOrEmail: memberToRemove.memberId,
          organizationId: activeOrg.id,
        });
        if (error) { toast.error(error.message || 'Failed to remove member'); setMemberToRemove(null); return; }
        setMemberToRemove(null);
        toast.success('Member removed');
        queryClient.invalidateQueries({ queryKey: ['organization', activeOrg.id, 'members'] });
      } else if (memberToRemove.type === 'invitation' && memberToRemove.invitationId) {
        const { error } = await authClient.organization.cancelInvitation({
          invitationId: memberToRemove.invitationId,
        });
        if (error) { toast.error(error.message || 'Failed to cancel invitation'); setMemberToRemove(null); return; }
        setMemberToRemove(null);
        toast.success('Invitation cancelled');
        queryClient.invalidateQueries({ queryKey: ['organization', activeOrg.id, 'invitations'] });
      }
    } catch {
      toast.error('An error occurred');
      setMemberToRemove(null);
    }
  };

  const handleSaveNewMember = async () => {
    if (!newEmail.trim() || !activeOrg) return;
    setIsSaving(true);
    try {
      const { error } = await authClient.organization.inviteMember({
        email: newEmail.trim(),
        role: newRole,
        organizationId: activeOrg.id,
      });
      if (error) { toast.error(error.message || 'Failed to send invitation'); return; }
      toast.success('Invitation sent');
      queryClient.invalidateQueries({ queryKey: ['organization', activeOrg.id, 'invitations'] });
      setNewEmail('');
      setNewRole('member');
      setIsAddingRow(false);
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelNewMember = () => {
    setNewEmail('');
    setNewRole('member');
    setIsAddingRow(false);
  };

  const columns = useMemo(
    () => createMemberColumns({
      onRoleChange: handleRoleChange,
      onRemove: handleRemove,
      organizationId: activeOrg?.id ?? '',
      teams,
    }),
    // eslint-disable-next-line
    [activeOrg?.id, teams],
  );

  const isLoading = isLoadingOrgs || (!!activeOrg && (isLoadingMembers || isLoadingInvitations));

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
            <Heading>Members</Heading>
            <Text className="mt-1">Manage who has access to {activeOrg?.name}.</Text>
          </div>
        </div>
      )}

      <BaseTable<MemberTableRow>
        columns={columns}
        data={rows}
        loading={isLoading}
        entityName="members"
        disableRowClick
        showAddRow={!isAddingRow}
        onAddRow={() => {
          setIsAddingRow(true);
          setTimeout(() => emailInputRef.current?.focus(), 0);
        }}
        addRowContent={
          isAddingRow ? (
            <TableRow
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  if (newEmail.trim()) {
                    handleSaveNewMember();
                  } else {
                    handleCancelNewMember();
                  }
                }
              }}
            >
              {/* sno */}
              <TableCell className="w-16 align-middle" />
              {/* name — empty for invite */}
              <TableCell className="align-middle" />
              {/* email */}
              <TableCell className="align-middle py-2">
                <Input
                  ref={emailInputRef}
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@example.com · Enter to invite"
                  disabled={isSaving}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNewMember();
                    if (e.key === 'Escape') handleCancelNewMember();
                  }}
                />
              </TableCell>
              {/* role select */}
              <TableCell className="align-middle py-2">
                <Select
                  value={newRole}
                  onChange={(e) =>
                    setNewRole(e.target.value as 'owner' | 'admin' | 'member')
                  }
                  disabled={isSaving}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r} className="capitalize">
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </Select>
              </TableCell>
              {/* status — empty */}
              <TableCell className="align-middle" />
              {/* joined at — empty */}
              <TableCell className="align-middle" />
              {/* actions — empty, Enter to submit / Escape or blur to cancel */}
              <TableCell className="align-middle">
                {isSaving && (
                  <span className="text-xs text-zinc-400">Sending...</span>
                )}
              </TableCell>
            </TableRow>
          ) : null
        }
        showEmptyState
        emptyStateConfig={{
          icon: UsersIcon,
          title: 'No members yet',
          description: 'Invite someone to your organization to give them access.',
          action: {
            label: 'Invite Member',
            onClick: () => {
              setIsAddingRow(true);
              setTimeout(() => emailInputRef.current?.focus(), 0);
            },
          },
        }}
      />

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        {rows.filter((r) => r.status === 'active').length} active ·{' '}
        {rows.filter((r) => r.status === 'invited').length} pending invitation
        {rows.filter((r) => r.status === 'invited').length !== 1 ? 's' : ''}
      </p>

      <Alert open={!!memberToRemove} onClose={() => setMemberToRemove(null)}>
        <AlertTitle>
          {memberToRemove?.type === 'member' ? 'Remove Member' : 'Cancel Invitation'}
        </AlertTitle>
        <AlertDescription>
          {memberToRemove?.type === 'member'
            ? `Are you sure you want to remove ${memberToRemove?.name} from the organization? They will lose all access.`
            : `Cancel the invitation sent to ${memberToRemove?.email}?`}
        </AlertDescription>
        <AlertActions>
          <Button plain onClick={() => setMemberToRemove(null)}>
            Cancel
          </Button>
          <Button color="red" onClick={confirmRemove}>
            {memberToRemove?.type === 'member' ? 'Remove' : 'Cancel Invitation'}
          </Button>
        </AlertActions>
      </Alert>
    </div>
  );
};

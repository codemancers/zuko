'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Badge, Select, Dropdown, DropdownButton, DropdownItem, DropdownMenu } from '@zuko/ui-kit';
import { UserMinusIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { DeleteAction, TableActionButton, TableActions, EMPTY_VALUE } from '../Table';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export type MemberTableRow = {
  id: string;
  type: 'member' | 'invitation';
  name: string;
  email: string;
  role: string;
  status: 'active' | 'invited';
  joinedAt?: Date;
  memberId?: string;
  invitationId?: string;
  userId?: string;
};

const ROLES = ['owner', 'admin', 'member'] as const;

function formatDate(d?: Date): string {
  if (!d) return EMPTY_VALUE;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

type MemberColumnHandlers = {
  onRoleChange: (row: MemberTableRow, role: string) => void;
  onRemove: (row: MemberTableRow) => void;
  organizationId: string;
  teams: { id: string; name: string }[];
};

function AddToTeamDropdown({
  row,
  organizationId,
  teams,
}: {
  row: MemberTableRow;
  organizationId: string;
  teams: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();

  const handleAddToTeam = async (teamId: string, teamName: string) => {
    if (!row.userId) return;
    try {
      const { error } = await authClient.organization.addTeamMember({
        userId: row.userId,
        teamId,
      });
      if (error) { toast.error(error.message || 'Failed to add to team'); return; }
      toast.success(`${row.name} added to ${teamName}`);
      queryClient.invalidateQueries({ queryKey: ['organization', organizationId, 'teams'] });
    } catch {
      toast.error('An error occurred');
    }
  };

  if (teams.length === 0) {
    return (
      <TableActionButton onClick={() => {}} label="No teams available" disabled>
        <UserGroupIcon className="h-4 w-4" />
      </TableActionButton>
    );
  }

  return (
    <Dropdown>
      <DropdownButton
        plain
        aria-label="Add to team"
        className="!text-zinc-400 data-hover:!text-zinc-600 dark:data-hover:!text-zinc-200 group rounded p-1.5"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <UserGroupIcon className="h-4 w-4" />
      </DropdownButton>
      <DropdownMenu>
        {teams.map((team) => (
          <DropdownItem
            key={team.id}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              handleAddToTeam(team.id, team.name);
            }}
          >
            {team.name}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}

export function createMemberColumns(
  handlers: MemberColumnHandlers,
): ColumnDef<MemberTableRow>[] {
  return [
    {
      id: 'name',
      header: 'Name',
      accessorKey: 'name',
      size: 180,
      cell: ({ row }) => (
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {row.original.name}
        </span>
      ),
    },
    {
      id: 'email',
      header: 'Email',
      accessorKey: 'email',
      size: 220,
      cell: ({ row }) => (
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {row.original.email}
        </span>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      accessorKey: 'role',
      size: 140,
      cell: ({ row }) => (
        <Select
          value={row.original.role}
          disabled={row.original.type === 'invitation'}
          onChange={(e) => handlers.onRoleChange(row.original, e.target.value)}
          onClick={(e) => e.stopPropagation()}
        >
          {ROLES.map((r) => (
            <option key={r} value={r} className="capitalize">
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </option>
          ))}
        </Select>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      size: 110,
      cell: ({ row }) => {
        const active = row.original.status === 'active';
        return (
          <Badge color={active ? 'lime' : 'amber'}>
            {active ? 'Active' : 'Invited'}
          </Badge>
        );
      },
    },
    {
      id: 'joinedAt',
      header: 'Joined At',
      accessorKey: 'joinedAt',
      size: 200,
      cell: ({ row }) => (
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {formatDate(row.original.joinedAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 100,
      cell: ({ row }) => (
        <TableActions>
          {row.original.type === 'member' && (
            <AddToTeamDropdown
              row={row.original}
              organizationId={handlers.organizationId}
              teams={handlers.teams}
            />
          )}
          {row.original.type === 'member' ? (
            <DeleteAction
              onClick={() => handlers.onRemove(row.original)}
              label="Remove member"
            />
          ) : (
            <TableActionButton
              onClick={() => handlers.onRemove(row.original)}
              label="Cancel invitation"
              variant="danger"
            >
              <UserMinusIcon className="h-4 w-4" />
            </TableActionButton>
          )}
        </TableActions>
      ),
    },
  ];
}

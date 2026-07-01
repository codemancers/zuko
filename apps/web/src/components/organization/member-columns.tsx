'use client';

import type { ColumnMetadata } from '@/types/table-metadata';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
} from '@zuko/ui-kit';
import { UserGroupIcon } from '@heroicons/react/24/outline';
import { TableActionButton } from '../Table';

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

export const MEMBER_TABLE_METADATA: ColumnMetadata[] = [
  {
    id: 'name',
    header: 'Name',
    fieldType: 'text',
    dataType: 'text',
    editable: false,
    isVisible: true,
  },
  {
    id: 'email',
    header: 'Email',
    fieldType: 'text',
    dataType: 'text',
    editable: false,
    isVisible: true,
    config: { render: 'email' },
  },
  {
    id: 'role',
    header: 'Role',
    fieldType: 'select',
    dataType: 'text',
    editable: true,
    isVisible: true,
    config: {
      options: [
        { label: 'Owner', value: 'owner' },
        { label: 'Admin', value: 'admin' },
        { label: 'Member', value: 'member' },
      ],
    },
  },
  {
    id: 'status',
    header: 'Status',
    fieldType: 'select',
    dataType: 'text',
    editable: false,
    isVisible: true,
    config: {
      render: 'badge',
      colorMap: { active: 'lime', invited: 'amber' },
    },
  },
  {
    id: 'joinedAt',
    header: 'Join Date',
    fieldType: 'date',
    dataType: 'date',
    editable: false,
    isVisible: true,
    config: { format: 'date' },
  },
];

export function AddToTeamDropdown({
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
      if (error) {
        toast.error(error.message || 'Failed to add to team');
        return;
      }
      toast.success(`${row.name} added to ${teamName}`);
      queryClient.invalidateQueries({
        queryKey: ['organization', organizationId, 'teams'],
      });
      queryClient.invalidateQueries({ queryKey: ['team', teamId, 'members'] });
    } catch {
      toast.error('An error occurred');
    }
  };

  if (teams.length === 0) {
    return (
      <TableActionButton
        onClick={Function.prototype as () => void}
        label="No teams available"
        disabled
      >
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

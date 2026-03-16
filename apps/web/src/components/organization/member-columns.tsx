'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { Badge } from '@zuko/ui-kit';
import { DataField } from '../Table/TableFields';

export type OrgMember = {
  id: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image?: string | null;
  };
};

type MemberColumnRenderers = {
  renderTeamsCell: (member: OrgMember) => ReactNode;
  renderActionsCell: (member: OrgMember) => ReactNode;
};

export function createMemberColumns(
  renderers: MemberColumnRenderers,
): ColumnDef<OrgMember>[] {
  return [
    {
      id: 'member',
      header: 'Member',
      cell: ({ row }) => (
        <DataField
          value={row.original.user.name || row.original.user.email}
          row={row.original}
          metadata={{
            id: 'member',
            header: 'Member',
            fieldType: 'entity',
            dataType: 'text',
            config: {
              entityType: 'member',
              useAvatar: true,
              avatarSrcField: row.original.user.image || undefined,
            },
          }}
        />
      ),
    },
    {
      id: 'role',
      header: 'Role',
      cell: ({ row }) => (
        <Badge color={row.original.role === 'owner' ? 'red' : 'blue'}>
          {row.original.role}
        </Badge>
      ),
    },
    {
      id: 'teams',
      header: 'Teams',
      cell: ({ row }) => renderers.renderTeamsCell(row.original),
    },
    {
      id: 'actions',
      header: () => (
        <span className="flex w-full justify-end pr-2">Actions</span>
      ),
      cell: ({ row }) => renderers.renderActionsCell(row.original),
    },
  ];
}


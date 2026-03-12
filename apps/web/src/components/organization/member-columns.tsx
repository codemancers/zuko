'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { Avatar, Badge } from '@zuko/ui-kit';

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
      cell: ({ row }) => {
        const member = row.original;
        const name = member.user.name || member.user.email;

        return (
          <div className="flex items-center gap-3">
            <Avatar
              src={member.user.image}
              initials={
                name
                  ?.split(/[\s.@]+/)
                  .filter(Boolean)
                  .map((n: string) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2) ?? ''
              }
              className="size-8 bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 ring-2 ring-white dark:ring-zinc-900"
            />
            <div className="flex flex-col">
              <div className="font-medium text-zinc-950 dark:text-white">
                {name}
              </div>
              <span className="text-xs text-zinc-500 mt-0.5">
                {member.user.email}
              </span>
            </div>
          </div>
        );
      },
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


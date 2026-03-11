'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { UserGroupIcon } from '@heroicons/react/24/outline';

export type OrgTeam = {
  id: string;
  name: string;
};

type TeamColumnRenderers = {
  renderMembersCell: (team: OrgTeam) => ReactNode;
  renderActionsCell: (team: OrgTeam) => ReactNode;
};

export function createTeamColumns(
  renderers: TeamColumnRenderers,
): ColumnDef<OrgTeam>[] {
  return [
    {
      id: 'team',
      header: 'Team',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <UserGroupIcon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div className="font-medium text-zinc-950 dark:text-white">
            {row.original.name}
          </div>
        </div>
      ),
    },
    {
      id: 'members',
      header: 'Members',
      cell: ({ row }) => renderers.renderMembersCell(row.original),
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



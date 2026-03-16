'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { ReactNode } from 'react';
import { DataField } from '../Table/TableFields';

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
        <DataField
          value={row.original.name}
          row={row.original}
          metadata={{
            id: 'team',
            header: 'Team',
            fieldType: 'entity',
            dataType: 'text',
            config: {
              entityType: 'team',
            },
          }}
        />
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



'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { ReactNode, useRef, useState } from 'react';
import { Input } from '@zuko/ui-kit';

export type OrgTeam = {
  id: string;
  name: string;
};

type TeamColumnRenderers = {
  renderMembersCell: (team: OrgTeam) => ReactNode;
  renderActionsCell: (team: OrgTeam) => ReactNode;
  onRename: (team: OrgTeam, newName: string) => void;
};

function EditableNameCell({
  team,
  onRename,
}: {
  team: OrgTeam;
  onRename: (team: OrgTeam, newName: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(team.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== team.name) {
      onRename(team, trimmed);
    } else {
      setValue(team.name);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setValue(team.name); setIsEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className="font-medium text-zinc-900 dark:text-zinc-100 cursor-text"
      onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
    >
      {team.name}
    </span>
  );
}

export function createTeamColumns(
  renderers: TeamColumnRenderers,
): ColumnDef<OrgTeam>[] {
  return [
    {
      id: 'team',
      header: 'Team',
      cell: ({ row }) => (
        <EditableNameCell team={row.original} onRename={renderers.onRename} />
      ),
    },
    {
      id: 'members',
      header: 'Members',
      cell: ({ row }) => renderers.renderMembersCell(row.original),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => renderers.renderActionsCell(row.original),
    },
  ];
}

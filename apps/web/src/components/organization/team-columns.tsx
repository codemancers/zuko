'use client';

import type { ColumnMetadata } from '@/types/table-metadata';

export type OrgTeam = {
  id: string;
  name: string;
};

export const TEAM_TABLE_METADATA: ColumnMetadata[] = [
  {
    id: 'name',
    header: 'Team',
    fieldType: 'text',
    dataType: 'text',
    editable: true,
    isVisible: true,
  },
];

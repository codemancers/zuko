'use client';

import { ColumnDef } from '@tanstack/react-table';
import { BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { Badge } from '@zuko/ui-kit';
import dayjs from 'dayjs';
import type { SalesCompany } from '@/lib/api/companies';

/**
 * These are the static definitions. 
 * This will be replaced by dynamic column definitions from the backend API
 */

export const companyColumns: ColumnDef<SalesCompany>[] = [
  {
    accessorKey: 'companyName',
    header: 'Company',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <BuildingOfficeIcon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
        </div>
        <div className="font-medium text-zinc-950 dark:text-white">
          {row.original.companyName}
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'website',
    header: 'Website',
    cell: ({ getValue }) => {
      const website = getValue() as string;
      return website ? (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {website.replace(/^https?:\/\//, '')}
        </a>
      ) : (
        <span className="text-sm text-zinc-600 dark:text-zinc-400">-</span>
      );
    },
  },
  {
    id: 'owner',
    header: 'Owner',
    accessorFn: (company) => {
      const primaryOwner = company.owners.find((o) => o.isPrimary);
      return primaryOwner?.user.name || company.owners[0]?.user.name || '-';
    },
    cell: ({ getValue }) => (
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {getValue() as string}
      </span>
    ),
  },
  {
    id: 'ownersCount',
    header: 'Owners Count',
    cell: ({ row }) =>
      row.original.owners.length > 1 ? (
        <Badge color="zinc" className="text-xs">
          +{row.original.owners.length - 1}
        </Badge>
      ) : null,
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ getValue }) => (
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {dayjs(getValue() as string).format('MMM D, YYYY')}
      </span>
    ),
  },
];

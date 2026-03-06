'use client';

import { ColumnDef } from '@tanstack/react-table';
import { BriefcaseIcon } from '@heroicons/react/24/outline';
import { Badge, Link } from '@zuko/ui-kit';
import dayjs from 'dayjs';
import type { Deal } from '@/lib/api/deals';

/**
 * These are the static definitions. 
 * This will be replaced by dynamic column definitions from the backend API
 */

const formatCurrency = (value?: number, currency?: string) => {
  if (value === undefined || value === null) return '-';
  const curr = currency || 'USD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const getStageColor = (
  stage: string,
): 'zinc' | 'blue' | 'yellow' | 'green' | 'red' => {
  const stageColors: Record<
    string,
    'zinc' | 'blue' | 'yellow' | 'green' | 'red'
  > = {
    prospecting: 'zinc',
    qualification: 'blue',
    proposal: 'yellow',
    negotiation: 'yellow',
    closed_won: 'green',
    closed_lost: 'red',
  };
  return stageColors[stage] || 'zinc';
};

const formatStage = (stage: string) => {
  return stage
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getPrimaryCompany = (deal: Deal) => {
  if (!deal.companies || deal.companies.length === 0) return null;
  const primaryCompany = deal.companies.find((a) => a.isPrimary);
  return primaryCompany || deal.companies[0] || null;
};

export const dealColumns: ColumnDef<Deal>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => {
      const deal = row.original;
      const company = getPrimaryCompany(deal);
      return (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <BriefcaseIcon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div>
            <div className="font-medium text-zinc-950 dark:text-white">{deal.title}</div>
            {company && (
              <Link
                href={`/companies/${company.companyId}`}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {company.company.companyName}
              </Link>
            )}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'value',
    header: 'Value',
    cell: ({ row }) => (
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {formatCurrency(row.original.value, row.original.currency)}
      </span>
    ),
  },
  {
    accessorKey: 'stage',
    header: 'Stage',
    cell: ({ getValue }) => {
      const stage = getValue() as string;
      return (
        <Badge
          color={getStageColor(stage)}
          className="text-xs"
        >
          {formatStage(stage)}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'probability',
    header: 'Probability',
    cell: ({ getValue }) => {
      const probability = getValue() as number | undefined;
      return (
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {probability !== undefined && probability !== null
            ? `${probability}%`
            : '-'}
        </span>
      );
    },
  },
  {
    id: 'owner',
    header: 'Owner',
    accessorFn: (deal) => {
      const primaryOwner = deal.owners.find((o) => o.isPrimary);
      return primaryOwner?.user.name || deal.owners[0]?.user.name || '-';
    },
    cell: ({ getValue }) => (
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: 'expectedCloseDate',
    header: 'Expected Close',
    cell: ({ getValue }) => {
      const date = getValue() as string | undefined;
      return (
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {date ? dayjs(date).format('MMM D, YYYY') : '-'}
        </span>
      );
    },
  },
];

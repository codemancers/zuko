'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { getProspects, getProspectStats } from '@/server/query-options';
import type { Prospect, ProspectStatus } from '@/lib/api/prospects';
import { PageHeader } from '@/components/shared';
import { BaseTable } from '@/components/Table';
import { Badge, Button, Sheet, SheetHeader, SheetTitle } from '@zuko/ui-kit';
import { XMarkIcon } from '@heroicons/react/24/outline';
import ProspectForm from './ProspectForm';
import {
  PROSPECT_STATUS_COLORS,
  PROSPECT_STATUS_LABELS,
  ENGAGEMENT_LABELS,
  humanize,
} from './lifecycle-display';

const STATUS_FILTERS: (ProspectStatus | 'all')[] = [
  'all',
  'new',
  'enrolled',
  'engaged',
  'promoted',
  'disqualified',
  'suppressed',
];

export default function ProspectsList() {
  const router = useRouter();
  const [status, setStatus] = useState<ProspectStatus | 'all'>('all');
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const { data, isLoading } = useQuery(
    getProspects(status === 'all' ? {} : { status: [status] }),
  );
  const { data: stats = [] } = useQuery(getProspectStats());

  const prospects = data?.data ?? [];
  const countFor = (value: ProspectStatus | 'all') =>
    value === 'all'
      ? stats.reduce((sum, s) => sum + s.count, 0)
      : (stats.find((s) => s.status === value)?.count ?? 0);

  const columns: ColumnDef<Prospect>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ getValue }) => (
          <span className="font-medium text-zinc-900 hover:underline dark:text-white">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: 'companyName',
        header: 'Company',
        cell: ({ getValue }) => (
          <span className="text-zinc-500 dark:text-zinc-400">
            {getValue<string>() ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ getValue }) => (
          <span className="text-zinc-500 dark:text-zinc-400">
            {getValue<string>() ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const value = getValue<ProspectStatus>();
          return (
            <Badge color={PROSPECT_STATUS_COLORS[value] ?? 'zinc'}>
              {PROSPECT_STATUS_LABELS[value] ?? value}
            </Badge>
          );
        },
      },
      {
        id: 'campaign',
        header: 'Campaign',
        cell: ({ row }) => {
          const open = row.original.memberships?.find(
            (m) => m.state !== 'completed' && m.state !== 'removed',
          );
          const latest = open ?? row.original.memberships?.[0];
          if (!latest) return '—';
          return (
            <span className="text-zinc-500 dark:text-zinc-400">
              {latest.campaign?.name ?? `Campaign ${latest.campaignId}`}
            </span>
          );
        },
      },
      {
        id: 'engagement',
        header: 'Engagement',
        cell: ({ row }) => {
          const latest = row.original.memberships?.[0];
          if (!latest) return '—';
          return (
            <Badge color="zinc">
              {ENGAGEMENT_LABELS[latest.engagement] ??
                humanize(latest.engagement)}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'source',
        header: 'Source',
        cell: ({ getValue }) => {
          const value = getValue<string>();
          return value ? <Badge color="zinc">{value}</Badge> : '—';
        },
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Prospects"
        description="People targeted by outbound, before they become leads"
        action={
          <Button color="dark" onClick={() => setIsSheetOpen(true)}>
            Add Prospect
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((value) => {
          const label = (
            <>
              {value === 'all'
                ? 'All'
                : (PROSPECT_STATUS_LABELS[value] ?? humanize(value))}
              <span className="ml-1.5 text-zinc-400">{countFor(value)}</span>
            </>
          );

          return status === value ? (
            <Button key={value} color="dark" onClick={() => setStatus(value)}>
              {label}
            </Button>
          ) : (
            <Button key={value} plain onClick={() => setStatus(value)}>
              {label}
            </Button>
          );
        })}
      </div>

      <BaseTable<Prospect>
        columns={columns}
        data={prospects}
        loading={isLoading}
        onRowClick={(row) => router.push(`/prospects/${row.id}`)}
        entityName="prospects"
        totalCount={data?.total}
      />

      <Sheet open={isSheetOpen} onClose={() => setIsSheetOpen(false)}>
        <SheetHeader>
          <SheetTitle>Add Prospect</SheetTitle>
          <Button plain onClick={() => setIsSheetOpen(false)}>
            <XMarkIcon className="size-5" />
          </Button>
        </SheetHeader>
        <ProspectForm onDone={() => setIsSheetOpen(false)} />
      </Sheet>
    </>
  );
}

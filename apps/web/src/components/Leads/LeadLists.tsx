'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { getLeadLists } from '@/server/query-options';
import type { LeadList } from '@/lib/api/leads';

type LeadListRow = LeadList & { id: number | string };
import { PageHeader } from '@/components/shared';
import { BaseTable } from '@/components/Table';
import { FunnelIcon } from '@heroicons/react/24/outline';

export default function LeadLists() {
  const router = useRouter();
  const { data: rawLists = [], isLoading } = useQuery(getLeadLists());
  const lists: LeadListRow[] = useMemo(
    () => rawLists.map((l) => ({ ...l, id: l.campaignId ?? 'uncampaigned' })),
    [rawLists],
  );

  const columns: ColumnDef<LeadListRow>[] = useMemo(
    () => [
      {
        accessorKey: 'campaignName',
        header: 'Campaign',
        cell: ({ getValue }) => (
          <span className="font-medium text-zinc-900 hover:underline dark:text-white">
            {getValue<string>() ?? 'Uncampaigned'}
          </span>
        ),
      },
      {
        accessorKey: 'leadCount',
        header: 'Leads',
        cell: ({ getValue }) => getValue<number>(),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader title="Leads" description="Prospects grouped by campaign" />

      <BaseTable<LeadListRow>
        columns={columns}
        data={lists}
        loading={isLoading}
        entityName="lead lists"
        onRowClick={(row) =>
          router.push(
            row.campaignId
              ? `/leads/campaign/${row.campaignId}`
              : '/leads/campaign/uncampaigned',
          )
        }
        showEmptyState
        emptyStateConfig={{
          icon: FunnelIcon,
          title: 'No leads yet',
          description: 'Connect Apollo to auto-capture replies from campaigns.',
          action: { label: 'Add Lead', onClick: () => {} },
        }}
      />
    </>
  );
}

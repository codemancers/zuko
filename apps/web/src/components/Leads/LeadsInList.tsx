'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { getLeads } from '@/server/query-options';
import { leadsApi, type Lead } from '@/lib/api/leads';
import { BackLink, LoadingState } from '@/components/shared';
import { Badge, Button, Heading } from '@zuko/ui-kit';
import { BaseTable, TableActions, DeleteAction } from '@/components/Table';
import { FunnelIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import dayjs from 'dayjs';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, 'green' | 'blue' | 'red' | 'zinc'> = {
  replied: 'blue',
  interested: 'green',
  not_interested: 'red',
  converted: 'zinc',
};

interface LeadsInListProps {
  campaignId: number;
}

export default function LeadsInList({ campaignId }: LeadsInListProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(getLeads({ campaignId }));
  const leads = data?.data ?? [];
  const campaignName = leads[0]?.campaign?.name;

  const convertMutation = useMutation({
    mutationFn: (id: number) => leadsApi.convert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'list'] });
      toast.success('Lead converted to deal');
    },
    onError: () => toast.error('Failed to convert lead'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => leadsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['leads', 'lists'] });
      toast.success('Lead deleted');
    },
    onError: () => toast.error('Failed to delete lead'),
  });

  const columns: ColumnDef<Lead>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ getValue }) => (
          <span className="font-medium text-zinc-900 dark:text-white">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ getValue }) => getValue<string>() ?? '—',
      },
      {
        accessorKey: 'companyName',
        header: 'Company',
        cell: ({ getValue }) => getValue<string>() ?? '—',
      },
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ getValue }) => getValue<string>() ?? '—',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const s = getValue<string>();
          return (
            <Badge color={STATUS_COLORS[s] ?? 'zinc'}>
              {s.replace(/_/g, ' ')}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ getValue }) => dayjs(getValue<string>()).format('MMM D, YYYY'),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <TableActions>
              {lead.status !== 'converted' && (
                <Button
                  plain
                  className="text-xs"
                  disabled={convertMutation.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    convertMutation.mutate(lead.id);
                  }}
                >
                  → Deal
                </Button>
              )}
              {lead.deal && (
                <Link
                  href={`/deals/${lead.deal.id}`}
                  className="text-xs text-blue-500 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View Deal
                </Link>
              )}
              <DeleteAction
                onClick={() => deleteMutation.mutate(lead.id)}
                disabled={deleteMutation.isPending}
              />
            </TableActions>
          );
        },
      },
    ],
    [convertMutation, deleteMutation],
  );

  if (isLoading) return <LoadingState message="Loading leads…" />;

  return (
    <div className="flex min-h-0 flex-col">
      <BackLink href="/leads">Leads</BackLink>

      <Heading className="mt-4">{campaignName ?? 'Leads'}</Heading>

      <BaseTable<Lead>
        columns={columns}
        data={leads}
        loading={isLoading}
        entityName="leads"
        onRowClick={(lead) =>
          router.push(`/leads/campaign/${campaignId}/${lead.id}`)
        }
        showEmptyState
        emptyStateConfig={{
          icon: FunnelIcon,
          title: 'No leads in this list',
          description: 'Leads from this campaign will appear here.',
          action: { label: 'Back', onClick: () => router.push('/leads') },
        }}
      />
    </div>
  );
}

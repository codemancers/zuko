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

  const revertMutation = useMutation({
    mutationFn: (id: number) => leadsApi.revert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'list'] });
      toast.success('Lead reverted');
    },
    onError: () => toast.error('Failed to revert lead'),
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
        cell: ({ row }) => (
          <Link
            href={`/leads/${row.original.id}`}
            className="font-medium text-zinc-900 hover:underline dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'companyName',
        header: 'Company',
        cell: ({ getValue }) => (
          <span className="text-zinc-500 dark:text-zinc-400">{getValue<string>() ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ getValue }) => (
          <span className="text-zinc-500 dark:text-zinc-400">{getValue<string>() ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ getValue }) => (
          <span className="text-zinc-500 dark:text-zinc-400">{getValue<string>() ?? '—'}</span>
        ),
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
        accessorKey: 'source',
        header: 'Source',
        cell: ({ getValue }) => {
          const s = getValue<string>();
          return s ? <Badge color="zinc">{s}</Badge> : '—';
        },
      },
      {
        accessorKey: 'icpProfile',
        header: 'ICP Profile',
        cell: ({ getValue }) => {
          const profile = getValue<{ id: number; name: string } | undefined>();
          return (
            <span className="text-zinc-500 dark:text-zinc-400">{profile?.name ?? '—'}</span>
          );
        },
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
              {lead.status === 'converted' && (
                <Button
                  plain
                  className="text-xs"
                  disabled={revertMutation.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    revertMutation.mutate(lead.id);
                  }}
                >
                  Revert
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
    [convertMutation, revertMutation, deleteMutation],
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

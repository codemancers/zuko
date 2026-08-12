'use client';

import { useMemo, useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { getLeadsInfinite } from '@/server/query-options';
import { leadsApi, type Lead } from '@/lib/api/leads';
import { BackLink, LoadingState } from '@/components/shared';
import {
  Badge,
  Button,
  Heading,
  Sheet,
  SheetHeader,
  SheetTitle,
} from '@zuko/ui-kit';
import {
  BaseTable,
  TableActions,
  TableActionButton,
  DeleteAction,
} from '@/components/Table';
import {
  FunnelIcon,
  ArrowRightIcon,
  ArrowUturnLeftIcon,
  ArrowTopRightOnSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { toast } from 'sonner';
import LeadForm from './LeadForm';

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
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery(getLeadsInfinite({ campaignId }));
  const leads = data?.pages.flatMap((p) => p.data) ?? [];
  const totalCount = data?.pages[0]?.total;
  const campaignName = leads[0]?.campaign?.name;

  const convertMutation = useMutation({
    mutationFn: (id: number) => leadsApi.convert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['leads', 'list', 'infinite'],
      });
      toast.success('Lead converted to deal');
    },
    onError: () => toast.error('Failed to convert lead'),
  });

  const revertMutation = useMutation({
    mutationFn: (id: number) => leadsApi.revert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['leads', 'list', 'infinite'],
      });
      toast.success('Lead reverted');
    },
    onError: () => toast.error('Failed to revert lead'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => leadsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['leads', 'list', 'infinite'],
      });
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
          <span className="text-zinc-500 dark:text-zinc-400">
            {getValue<string>() ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'title',
        header: 'Title',
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
          if (!profile) return '—';
          return (
            <Link
              href={`/icps/${profile.id}`}
              className="font-medium text-zinc-900 hover:underline dark:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              {profile.name}
            </Link>
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
                <TableActionButton
                  onClick={() => convertMutation.mutate(lead.id)}
                  label="Convert to Deal"
                  disabled={convertMutation.isPending}
                  variant="success"
                >
                  <ArrowRightIcon className="h-4 w-4" />
                </TableActionButton>
              )}
              {lead.status === 'converted' && (
                <TableActionButton
                  onClick={() => revertMutation.mutate(lead.id)}
                  label="Revert"
                  disabled={revertMutation.isPending}
                >
                  <ArrowUturnLeftIcon className="h-4 w-4" />
                </TableActionButton>
              )}
              {lead.deal && (
                <TableActionButton
                  onClick={() => router.push(`/deals/${lead.deal!.id}`)}
                  label="View Deal"
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </TableActionButton>
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

      <div className="mt-4 flex items-center justify-between">
        <Heading>{campaignName ?? 'Leads'}</Heading>
        <Button color="dark" onClick={() => setIsSheetOpen(true)}>
          Add Lead
        </Button>
      </div>

      <BaseTable<Lead>
        columns={columns}
        data={leads}
        loading={isLoading}
        entityName="leads"
        totalCount={totalCount}
        onFetchNextPage={fetchNextPage}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
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
      <Sheet open={isSheetOpen} onClose={setIsSheetOpen} side="right">
        <SheetHeader>
          <SheetTitle>New Lead</SheetTitle>
          <Button plain onClick={() => setIsSheetOpen(false)}>
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </SheetHeader>
        <LeadForm onSuccess={() => setIsSheetOpen(false)} />
      </Sheet>
    </div>
  );
}

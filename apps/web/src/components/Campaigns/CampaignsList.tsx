'use client';

import { useMemo } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { Button, BadgeButton } from '@zuko/ui-kit';
import { PlusIcon, ArrowPathIcon } from '@heroicons/react/20/solid';
import { MegaphoneIcon } from '@heroicons/react/24/outline';
import { getCampaignsInfinite } from '@/server/query-options';
import { apolloSequencesApi, type ApolloSequence } from '@/lib/api/apollo';
import { PageHeader, SearchBar } from '@/components/shared';
import { BaseTable } from '@/components/Table';
import { useSearchParam } from '@/hooks/use-search-param';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { formatRate } from './campaign-shared';

export default function CampaignsList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { inputValue, setInputValue, debouncedValue } = useSearchParam();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery(getCampaignsInfinite(debouncedValue || undefined));

  const campaigns = useMemo(
    () => data?.pages.flatMap((p) => p.emailer_campaigns) ?? [],
    [data],
  );
  const totalCount = data?.pages[0]?.pagination?.total_entries ?? 0;

  const approveMutation = useMutation({
    mutationFn: (id: string) => apolloSequencesApi.approve(id),
    onSuccess: () => {
      toast.success('Campaign activated');
      queryClient.invalidateQueries({
        queryKey: ['campaigns', 'infinite', debouncedValue || undefined],
      });
    },
    onError: () => {
      toast.error('Failed to activate campaign');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apolloSequencesApi.deactivate(id),
    onSuccess: () => {
      toast.success('Campaign deactivated');
      queryClient.invalidateQueries({
        queryKey: ['campaigns', 'infinite', debouncedValue || undefined],
      });
    },
    onError: () => {
      toast.error('Failed to deactivate campaign');
    },
  });

  const columns: ColumnDef<ApolloSequence>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div className="font-medium text-zinc-900 dark:text-white">
            {row.original.name}
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const campaign = row.original;
          return campaign.active ? (
            <BadgeButton
              color="green"
              title="Click to deactivate"
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                deactivateMutation.mutate(campaign.id);
              }}
            >
              Active
            </BadgeButton>
          ) : (
            <BadgeButton
              color="zinc"
              title="Click to activate"
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                approveMutation.mutate(campaign.id);
              }}
            >
              Inactive
            </BadgeButton>
          );
        },
      },
      {
        accessorKey: 'num_steps',
        header: 'Steps',
        cell: ({ getValue }) => getValue<number>() ?? '—',
      },
      {
        id: 'open_rate',
        header: 'Open Rate',
        cell: ({ row }) => formatRate(row.original.open_rate),
      },
      {
        id: 'reply_rate',
        header: 'Reply Rate',
        cell: ({ row }) => formatRate(row.original.reply_rate),
      },
      {
        id: 'delivered',
        header: 'Delivered',
        cell: ({ row }) => {
          const val = row.original.unique_delivered;
          return typeof val === 'number' ? val.toLocaleString() : val || '—';
        },
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ getValue }) => dayjs(getValue<string>()).format('MMM D, YYYY'),
      },
    ],
    [approveMutation, deactivateMutation],
  );

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Manage Apollo email sequences and track their performance."
        action={
          <div className="flex items-center gap-2">
            <Button outline onClick={() => refetch()} aria-label="Refresh">
              <ArrowPathIcon className="size-4" />
            </Button>
            <Button onClick={() => router.push('/campaigns/add')}>
              <PlusIcon className="size-4" />
              New Campaign
            </Button>
          </div>
        }
      />

      <SearchBar
        value={inputValue}
        onChange={setInputValue}
        placeholder="Search campaigns…"
      />

      <BaseTable<ApolloSequence>
        columns={columns}
        data={campaigns}
        loading={isLoading}
        entityName="campaigns"
        onRowClick={(campaign) => router.push(`/campaigns/${campaign.id}`)}
        totalCount={totalCount}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onFetchNextPage={fetchNextPage}
        showEmptyState
        emptyStateConfig={{
          icon: MegaphoneIcon,
          title: 'No campaigns yet',
          description:
            'Create your first campaign to start sending email sequences via Apollo.',
          action: {
            label: 'New Campaign',
            onClick: () => router.push('/campaigns/add'),
          },
        }}
      />
    </>
  );
}

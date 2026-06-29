'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { BadgeButton } from '@zuko/ui-kit';
import { MegaphoneIcon } from '@heroicons/react/24/outline';
import { getCampaignsByIcpProfile } from '@/server/query-options';
import { apolloSequencesApi, type ZukoCampaign } from '@/lib/api/apollo';
import { BaseTable } from '@/components/Table';
import { toast } from 'sonner';
import dayjs from 'dayjs';

function CampaignStatusCell({
  campaign,
  onApprove,
  onDeactivate,
}: {
  campaign: ZukoCampaign;
  onApprove: (id: string) => void;
  onDeactivate: (id: string) => void;
}) {
  return campaign.active ? (
    <BadgeButton
      color="green"
      title="Click to deactivate"
      className="cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        if (campaign.providerSequenceId)
          onDeactivate(campaign.providerSequenceId);
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
        if (campaign.providerSequenceId) onApprove(campaign.providerSequenceId);
      }}
    >
      Inactive
    </BadgeButton>
  );
}

function buildColumnsWithActions(
  onApprove: (id: string) => void,
  onDeactivate: (id: string) => void,
): ColumnDef<ZukoCampaign>[] {
  return [
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
      cell: ({ row }) => (
        <CampaignStatusCell
          campaign={row.original}
          onApprove={onApprove}
          onDeactivate={onDeactivate}
        />
      ),
    },
    {
      id: 'steps',
      header: 'Steps',
      cell: ({ row }) => {
        const count = Array.isArray(row.original.sequence)
          ? row.original.sequence.length
          : 0;
        return count || '—';
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ getValue }) => dayjs(getValue<string>()).format('MMM D, YYYY'),
    },
  ];
}

export default function IcpCampaignsPanel({
  profileId,
  onNew,
}: {
  profileId: number;
  onNew?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery(
    getCampaignsByIcpProfile(profileId),
  );

  const approveMutation = useMutation({
    mutationFn: (id: string) => apolloSequencesApi.approve(id),
    onSuccess: () => {
      toast.success('Campaign activated');
      queryClient.invalidateQueries({
        queryKey: ['campaigns', 'by-icp', profileId],
      });
    },
    onError: () => toast.error('Failed to activate campaign'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apolloSequencesApi.deactivate(id),
    onSuccess: () => {
      toast.success('Campaign deactivated');
      queryClient.invalidateQueries({
        queryKey: ['campaigns', 'by-icp', profileId],
      });
    },
    onError: () => toast.error('Failed to deactivate campaign'),
  });

  const columnsWithActions = useMemo(
    () =>
      buildColumnsWithActions(
        (id) => approveMutation.mutate(id),
        (id) => deactivateMutation.mutate(id),
      ),
    [approveMutation, deactivateMutation],
  );

  return (
    <div className="space-y-4 [&>div]:mt-0">
      <BaseTable<ZukoCampaign>
        columns={columnsWithActions}
        data={campaigns}
        loading={isLoading}
        entityName="campaigns"
        onRowClick={(campaign) => router.push(`/campaigns/${campaign.id}`)}
        totalCount={campaigns.length}
        showEmptyState
        emptyStateConfig={{
          icon: MegaphoneIcon,
          title: 'No campaigns yet',
          description:
            'Create a campaign to start reaching contacts from this ICP.',
          action: {
            label: 'New Campaign',
            onClick: () => onNew?.(),
          },
        }}
      />
    </div>
  );
}

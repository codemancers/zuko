'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Heading,
  Sheet,
  SheetBody,
  SheetHeader,
  SheetTitle,
  Text,
} from '@zuko/ui-kit';
import { PencilIcon } from '@heroicons/react/20/solid';
import { getCampaignById, getZukoCampaign } from '@/server/query-options';
import { apolloSequencesApi } from '@/lib/api/apollo';
import { BackLink, LoadingState } from '@/components/shared';
import CampaignForm from './CampaignForm';
import { toast } from 'sonner';
import dayjs from 'dayjs';

interface CampaignDetailProps {
  sequenceId: string;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function formatRate(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? '—' : `${(num * 100).toFixed(1)}%`;
}

export default function CampaignDetail({ sequenceId }: CampaignDetailProps) {
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: campaign, isLoading: isLoadingCampaign } = useQuery(
    getCampaignById(sequenceId),
  );

  const { data: zukoCampaign, isLoading: isLoadingZuko } = useQuery({
    ...getZukoCampaign(sequenceId),
    retry: false,
  });

  const approveMutation = useMutation({
    mutationFn: () => apolloSequencesApi.approve(sequenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'infinite'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', sequenceId] });
      toast.success('Campaign approved and activated');
    },
    onError: () => toast.error('Failed to approve campaign'),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => apolloSequencesApi.deactivate(sequenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'infinite'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', sequenceId] });
      toast.success('Campaign deactivated');
    },
    onError: () => toast.error('Failed to deactivate campaign'),
  });

  const isPending = approveMutation.isPending || deactivateMutation.isPending;

  if (isLoadingCampaign) return <LoadingState message="Loading campaign…" />;
  if (!campaign)
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Campaign not found.
      </p>
    );

  return (
    <>
      <BackLink href="/campaigns">Campaigns</BackLink>

      <div className="mt-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Heading>{campaign.name}</Heading>
          <Badge color={campaign.active ? 'green' : 'zinc'}>
            {campaign.active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {zukoCampaign && (
            <Button outline onClick={() => setIsEditSheetOpen(true)}>
              <PencilIcon className="size-4" />
              Edit
            </Button>
          )}
          {campaign.active ? (
            <Button
              outline
              disabled={isPending}
              onClick={() => deactivateMutation.mutate()}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              color="dark"
              disabled={isPending}
              onClick={() => approveMutation.mutate()}
            >
              Approve
            </Button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Steps" value={String(campaign.num_steps ?? '—')} />
        <StatCard label="Open Rate" value={formatRate(campaign.open_rate)} />
        <StatCard label="Reply Rate" value={formatRate(campaign.reply_rate)} />
        <StatCard
          label="Delivered"
          value={
            typeof campaign.unique_delivered === 'number'
              ? campaign.unique_delivered.toLocaleString()
              : String(campaign.unique_delivered || '—')
          }
        />
      </div>

      {/* Sequence steps (from Zuko DB) */}
      <div className="mt-8">
        <p className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">
          Sequence Steps
        </p>

        {isLoadingZuko && (
          <p className="text-sm text-zinc-500">Loading steps…</p>
        )}

        {!isLoadingZuko && !zukoCampaign && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
            <Text className="text-sm text-zinc-500 dark:text-zinc-400">
              Step details are only available for campaigns created via Zuko.
            </Text>
          </div>
        )}

        {zukoCampaign && zukoCampaign.sequence.length > 0 && (
          <div className="space-y-3">
            {zukoCampaign.sequence.map((step, index) => {
              const touch = step.emailer_touches[0];
              const template = touch?.emailer_template;
              return (
                <div
                  key={step.id}
                  className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                      {index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge color="blue">
                        {step.type === 'auto_email'
                          ? 'Auto Email'
                          : 'Manual Email'}
                      </Badge>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        Wait {step.wait_time} {step.wait_mode}
                        {step.wait_time !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {template && (
                    <div className="mt-3 pl-9 space-y-1">
                      {template.subject && (
                        <p className="text-sm font-medium text-zinc-900 dark:text-white">
                          {template.subject}
                        </p>
                      )}
                      <p className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {template.body_html.replace(/<[^>]+>/g, ' ').trim()}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {zukoCampaign && zukoCampaign.sequence.length === 0 && (
          <p className="text-sm text-zinc-500">No steps defined.</p>
        )}
      </div>

      {/* Metadata */}
      <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-700">
        <div className="flex gap-8 text-sm text-zinc-500 dark:text-zinc-400">
          {zukoCampaign && (
            <>
              <span>
                Created {dayjs(zukoCampaign.createdAt).format('MMM D, YYYY')}
              </span>
              <span>
                Updated {dayjs(zukoCampaign.updatedAt).format('MMM D, YYYY')}
              </span>
            </>
          )}
          <span>
            Permissions: {zukoCampaign?.permissions?.replace(/_/g, ' ') ?? '—'}
          </span>
        </div>
      </div>

      {zukoCampaign && (
        <Sheet open={isEditSheetOpen} onClose={() => setIsEditSheetOpen(false)}>
          <SheetHeader>
            <SheetTitle>Edit Campaign</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <CampaignForm
              mode="edit"
              campaign={zukoCampaign}
              onSuccess={() => setIsEditSheetOpen(false)}
              onCancel={() => setIsEditSheetOpen(false)}
            />
          </SheetBody>
        </Sheet>
      )}
    </>
  );
}

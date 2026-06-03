'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Heading,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
  Text,
} from '@zuko/ui-kit';
import { PlusIcon } from '@heroicons/react/20/solid';
import { getCampaignById, getZukoCampaign } from '@/server/query-options';
import {
  apolloSequencesApi,
  type CreateSequencePayload,
} from '@/lib/api/apollo';
import { BackLink, LoadingState } from '@/components/shared';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import {
  StepCard,
  type StepFormState,
  campaignToSteps,
  defaultStep,
  formatRate,
  stepsToPayload,
} from './campaign-shared';

// ─── Sidebar stat row ─────────────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <div className="mt-1 text-sm text-zinc-200">{value}</div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface CampaignDetailProps {
  sequenceId: string;
}

const TABS = ['Editor', 'Analytics'] as const;

export default function CampaignDetail({ sequenceId }: CampaignDetailProps) {
  const queryClient = useQueryClient();
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const { data: campaign, isLoading: isLoadingCampaign } = useQuery(
    getCampaignById(sequenceId),
  );
  const { data: zukoCampaign, isLoading: isLoadingZuko } = useQuery({
    ...getZukoCampaign(sequenceId),
    retry: false,
  });

  const [permissions, setPermissions] = useState<string>(
    zukoCampaign?.permissions ?? 'team_can_use',
  );
  const [steps, setSteps] = useState<StepFormState[]>(() =>
    zukoCampaign ? campaignToSteps(zukoCampaign) : [],
  );

  const [initialized, setInitialized] = useState(false);
  if (zukoCampaign && !initialized) {
    setSteps(campaignToSteps(zukoCampaign));
    setPermissions(zukoCampaign.permissions);
    setInitialized(true);
  }

  const approveMutation = useMutation({
    mutationFn: () => apolloSequencesApi.approve(sequenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'infinite'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', sequenceId] });
      toast.success('Campaign activated');
    },
    onError: () => toast.error('Failed to activate campaign'),
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

  const updateMutation = useMutation({
    mutationFn: (payload: CreateSequencePayload) =>
      apolloSequencesApi.update(sequenceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'infinite'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', sequenceId] });
      queryClient.invalidateQueries({
        queryKey: ['campaign', 'zuko', sequenceId],
      });
      toast.success('Campaign updated');
    },
    onError: () => toast.error('Failed to update campaign'),
  });

  const isMutating =
    approveMutation.isPending ||
    deactivateMutation.isPending ||
    updateMutation.isPending;

  if (isLoadingCampaign) return <LoadingState message="Loading campaign…" />;
  if (!campaign)
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Campaign not found.
      </p>
    );

  const handleUpdate = () => {
    if (!zukoCampaign) return;
    const payload: CreateSequencePayload = {
      name: campaign.name,
      permissions: permissions as 'private' | 'team_can_view' | 'team_can_use',
      sequence: stepsToPayload(steps),
    };
    updateMutation.mutate(payload);
  };

  const addStep = () => setSteps((prev) => [...prev, defaultStep()]);
  const removeStep = (i: number) =>
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  const updateStep = (i: number, updated: StepFormState) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? updated : s)));

  return (
    <div className="flex min-h-0 flex-col">
      <BackLink href="/campaigns">Campaigns</BackLink>

      <div className="mt-4 flex items-start justify-between">
        <Heading>{campaign.name}</Heading>

        <div className="flex items-center gap-2">
          {campaign.active ? (
            <Button
              outline
              disabled={isMutating}
              onClick={() => deactivateMutation.mutate()}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              outline
              disabled={isMutating}
              onClick={() => approveMutation.mutate()}
            >
              Approve
            </Button>
          )}
          {zukoCampaign && (
            <Button
              color="dark"
              disabled={isMutating || steps.length === 0}
              onClick={handleUpdate}
            >
              {updateMutation.isPending ? 'Saving…' : 'Update Campaign'}
            </Button>
          )}
        </div>
      </div>

      <Tabs
        selectedIndex={activeTabIndex}
        onChange={(i: number) => setActiveTabIndex(i)}
      >
        <TabsList variant="line" className="mt-4 !justify-start">
          {TABS.map((label) => (
            <TabsTrigger key={label}>{label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-6 flex-1">
        {/* Editor tab */}
        {activeTabIndex === 0 && (
          <div className="flex gap-8 items-start">
            <div className="min-w-0 flex-1">
              {isLoadingZuko && (
                <p className="text-sm text-zinc-500">Loading steps…</p>
              )}

              {!isLoadingZuko && !zukoCampaign && (
                <div className="rounded-xl border border-zinc-700/60 bg-zinc-900 p-8 text-center">
                  <Text className="text-sm text-zinc-400">
                    Step editing is only available for campaigns created via
                    Zuko.
                  </Text>
                </div>
              )}

              {steps.length > 0 && (
                <div className="space-y-4">
                  {steps.map((step, i) => (
                    <StepCard
                      key={step.stableKey}
                      index={i}
                      step={step}
                      canRemove={steps.length > 1}
                      onChange={(updated) => updateStep(i, updated)}
                      onRemove={() => removeStep(i)}
                      disabled={isMutating}
                    />
                  ))}
                </div>
              )}

              {zukoCampaign && (
                <button
                  type="button"
                  onClick={addStep}
                  disabled={isMutating}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 py-4 text-sm text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
                >
                  <PlusIcon className="size-4" />
                  Add step
                </button>
              )}
            </div>

            {/* Right sidebar */}
            <div className="w-56 shrink-0 space-y-8">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Settings
                </p>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-zinc-500">
                    Access
                  </p>
                  <Select
                    value={permissions}
                    onChange={(e) => setPermissions(e.target.value)}
                    disabled={isMutating}
                  >
                    <option value="team_can_use">Team can use</option>
                    <option value="team_can_view">Team can view</option>
                    <option value="private">Private</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Campaign Details
                </p>

                <StatRow
                  label="Status"
                  value={
                    <Badge color={campaign.active ? 'green' : 'zinc'}>
                      {campaign.active ? 'Active' : 'Inactive'}
                    </Badge>
                  }
                />
                <StatRow
                  label="Steps"
                  value={String(campaign.num_steps ?? 0)}
                />
                <StatRow
                  label="Delivered"
                  value={
                    typeof campaign.unique_delivered === 'number'
                      ? campaign.unique_delivered.toLocaleString()
                      : String(campaign.unique_delivered || 0)
                  }
                />
                <StatRow
                  label="Open Rate"
                  value={formatRate(campaign.open_rate)}
                />
                <StatRow
                  label="Reply Rate"
                  value={formatRate(campaign.reply_rate)}
                />
                <StatRow
                  label="Sequence ID"
                  value={
                    <span className="font-mono text-xs text-zinc-400 break-all">
                      {sequenceId}
                    </span>
                  }
                />
                <StatRow
                  label="Created"
                  value={
                    zukoCampaign
                      ? dayjs(zukoCampaign.createdAt).format('MMM D, YYYY')
                      : '—'
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Analytics tab */}
        {activeTabIndex === 1 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Steps', value: String(campaign.num_steps ?? 0) },
              {
                label: 'Delivered',
                value:
                  typeof campaign.unique_delivered === 'number'
                    ? campaign.unique_delivered.toLocaleString()
                    : '0',
              },
              { label: 'Open Rate', value: formatRate(campaign.open_rate) },
              { label: 'Reply Rate', value: formatRate(campaign.reply_rate) },
              {
                label: 'Bounce Rate',
                value: formatRate(campaign.bounce_rate ?? 0),
              },
              {
                label: 'Click Rate',
                value: formatRate(campaign.click_rate ?? 0),
              },
              {
                label: 'Opt-out Rate',
                value: formatRate(campaign.opt_out_rate ?? 0),
              },
              {
                label: 'Unique Opened',
                value:
                  typeof campaign.unique_opened === 'number'
                    ? campaign.unique_opened.toLocaleString()
                    : '0',
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl border border-zinc-700/60 bg-zinc-900 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">
                  {value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

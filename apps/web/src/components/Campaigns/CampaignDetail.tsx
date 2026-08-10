'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Heading,
  Tabs,
  TabsList,
  TabsTrigger,
  Text,
} from '@zuko/ui-kit';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import {
  getZukoCampaignByDbId,
  getCampaignsByIcpProfile,
} from '@/server/query-options';
import { apolloSequencesApi } from '@/lib/api/apollo';
import { BackLink, LoadingState } from '@/components/shared';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { formatRate } from './campaign-shared';
import SequenceEditorPanel from './SequenceEditorPanel';

// ─── Tab config ───────────────────────────────────────────────────────────────

type Tab = 'analytics' | 'sequence'
const TAB_VALUES = ['analytics', 'sequence'] as const;
const tabParser = parseAsStringLiteral(TAB_VALUES).withDefault('analytics');

const TABS: { id: Tab; label: string }[] = [
  { id: 'analytics', label: 'Analytics' },
  { id: 'sequence', label: 'Sequence Editor' },
];

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-900 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface CampaignDetailProps {
  zukoId: number;
}

export default function CampaignDetail({ zukoId }: CampaignDetailProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useQueryState('tab', tabParser);
  const saveSequenceRef = useRef<{ save: () => void } | null>(null);
  const [isSavingSequence, setIsSavingSequence] = useState(false);

  const { data: campaign, isLoading } = useQuery(getZukoCampaignByDbId(zukoId));

  const { data: liveSequence } = useQuery({
    queryKey: ['campaign', campaign?.providerSequenceId],
    queryFn: async () => {
      const res = await apolloSequencesApi.list({ name: '' });
      return (
        res.emailer_campaigns.find(
          (c) => c.id === campaign!.providerSequenceId,
        ) ?? null
      );
    },
    enabled: !!campaign?.providerSequenceId,
    staleTime: 30_000,
  });

  const isActive = liveSequence
    ? liveSequence.active
    : (campaign?.active ?? false);

  const approveMutation = useMutation({
    mutationFn: () => apolloSequencesApi.approve(campaign!.providerSequenceId!),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['campaign', 'zuko-db', zukoId],
      });
      queryClient.invalidateQueries({
        queryKey: ['campaign', campaign?.providerSequenceId],
      });
      toast.success('Campaign activated');
    },
    onError: () => toast.error('Failed to activate campaign'),
  });

  const deactivateMutation = useMutation({
    mutationFn: () =>
      apolloSequencesApi.deactivate(campaign!.providerSequenceId!),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['campaign', 'zuko-db', zukoId],
      });
      queryClient.invalidateQueries({
        queryKey: ['campaign', campaign?.providerSequenceId],
      });
      toast.success('Campaign deactivated');
    },
    onError: () => toast.error('Failed to deactivate campaign'),
  });

  const isMutating = approveMutation.isPending || deactivateMutation.isPending;

  if (isLoading) return <LoadingState message="Loading campaign…" />;
  if (!campaign)
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Campaign not found.
      </p>
    );

  const hasSequence = !!campaign.providerSequenceId;

  return (
    <>
      <div className="flex min-h-0 flex-col">
        <BackLink href="/campaigns">Campaigns</BackLink>

        <div className="mt-4 flex items-start justify-between gap-4">
          <Heading>{campaign.name}</Heading>

          <div className="flex shrink-0 items-center gap-2">
            {activeTab === 'sequence' && (
              <Button
                color="dark"
                disabled={isSavingSequence}
                onClick={() => saveSequenceRef.current?.save()}
              >
                {isSavingSequence ? 'Saving…' : 'Save Sequence'}
              </Button>
            )}
            {hasSequence &&
              (isActive ? (
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
              ))}
          </div>
        </div>

        <Tabs
          selectedIndex={TABS.findIndex((t) => t.id === activeTab)}
          onChange={(i: number) => setActiveTab(TABS[i].id)}
        >
          <TabsList variant="line" className="mt-4 !justify-start">
            {TABS.map(({ id, label }) => (
              <TabsTrigger key={id}>{label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="mt-6 flex items-start gap-8">
          {/* Main content */}
          <div className="min-w-0 flex-1">
            {/* Sequence Editor tab */}
            {activeTab === 'sequence' && (
              <SequenceEditorPanel
                campaign={campaign}
                actionRef={saveSequenceRef}
                onPendingChange={setIsSavingSequence}
              />
            )}

            {/* Analytics tab */}
            {activeTab === 'analytics' && (
              <div>
                {!hasSequence ? (
                  <div className="rounded-xl border border-zinc-700/60 bg-zinc-900 p-8 text-center">
                    <Text className="text-sm text-zinc-400">
                      Analytics will be available once the campaign sequence is
                      saved and activated.
                    </Text>
                  </div>
                ) : (
                  <CampaignAnalytics
                    sequenceId={campaign.providerSequenceId!}
                  />
                )}
              </div>
            )}
          </div>

          {/* Campaign details sidebar */}
          <div className="w-64 shrink-0 space-y-5 border-l border-zinc-200 pl-8 dark:border-zinc-700/50">
            <div>
              <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Status
              </Text>
              <div className="mt-1.5">
                <Badge color={isActive ? 'green' : 'zinc'}>
                  {isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>

            <div>
              <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Created
              </Text>
              <Text className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                {dayjs(campaign.createdAt).format('MMM D, YYYY')}
              </Text>
            </div>

            {campaign.icpProfileId && (
              <div>
                <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  ICP Profile
                </Text>
                <a
                  href={`/icps/${campaign.icpProfileId}?tab=campaigns`}
                  className="mt-1 block text-sm text-zinc-700 hover:underline dark:text-zinc-300"
                >
                  {campaign.icpProfile?.name ?? `ICP #${campaign.icpProfileId}`}
                </a>
              </div>
            )}

            {hasSequence && (
              <div>
                <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Sequence ID
                </Text>
                <Text className="mt-1 break-all font-mono text-xs text-zinc-500">
                  {campaign.providerSequenceId}
                </Text>
              </div>
            )}

            {campaign.icpProfileId && (
              <IcpCampaignsList
                icpProfileId={campaign.icpProfileId}
                currentCampaignId={campaign.id}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Sidebar campaigns list ───────────────────────────────────────────────────

function IcpCampaignsList({
  icpProfileId,
  currentCampaignId,
}: {
  icpProfileId: number;
  currentCampaignId: number;
}) {
  const { data: campaigns = [], isLoading } = useQuery(
    getCampaignsByIcpProfile(icpProfileId),
  );

  const others = campaigns.filter((c) => c.id !== currentCampaignId);

  if (isLoading)
    return <p className="text-xs text-zinc-500">Loading campaigns…</p>;

  if (others.length === 0) return null;

  return (
    <div>
      <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Other Campaigns
      </Text>
      <ul className="mt-2 space-y-2">
        {others.map((c) => (
          <li key={c.id}>
            <a
              href={`/campaigns/${c.id}`}
              className="flex items-center justify-between gap-2 text-sm text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
            >
              <span className="truncate">{c.name}</span>
              <Badge color={c.active ? 'green' : 'zinc'} className="shrink-0">
                {c.active ? 'Active' : 'Inactive'}
              </Badge>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Analytics sub-component ──────────────────────────────────────────────────

function CampaignAnalytics({ sequenceId }: { sequenceId: string }) {
  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', sequenceId],
    queryFn: async () => {
      const res = await apolloSequencesApi.list({ name: '' });
      const found = res.emailer_campaigns.find((c) => c.id === sequenceId);
      if (!found) throw new Error('Not found');
      return found;
    },
    retry: false,
  });

  if (isLoading)
    return <p className="text-sm text-zinc-500">Loading analytics…</p>;
  if (!campaign)
    return (
      <p className="text-sm text-zinc-500">
        Could not load analytics from Apollo.
      </p>
    );

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard label="Steps" value={String(campaign.num_steps ?? 0)} />
      <StatCard
        label="Delivered"
        value={
          typeof campaign.unique_delivered === 'number'
            ? campaign.unique_delivered.toLocaleString()
            : '0'
        }
      />
      <StatCard label="Open Rate" value={formatRate(campaign.open_rate)} />
      <StatCard label="Reply Rate" value={formatRate(campaign.reply_rate)} />
      <StatCard
        label="Bounce Rate"
        value={formatRate(campaign.bounce_rate ?? 0)}
      />
      <StatCard
        label="Click Rate"
        value={formatRate(campaign.click_rate ?? 0)}
      />
      <StatCard
        label="Opt-out Rate"
        value={formatRate(campaign.opt_out_rate ?? 0)}
      />
      <StatCard
        label="Unique Opened"
        value={
          typeof campaign.unique_opened === 'number'
            ? campaign.unique_opened.toLocaleString()
            : '0'
        }
      />
    </div>
  );
}

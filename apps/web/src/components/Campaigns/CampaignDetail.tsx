'use client';

import { lazy, Suspense, useRef, useState, useMemo } from 'react';
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
import { getZukoCampaignByDbId } from '@/server/query-options';
import {
  apolloSequencesApi,
  apolloProspectsApi,
  type SequenceContact,
} from '@/lib/api/apollo';
import type { ColumnDef } from '@tanstack/react-table';
import { BaseTable } from '@/components/Table';
import { BackLink, LoadingState } from '@/components/shared';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { formatRate } from './campaign-shared';
import SequenceEditorPanel from './SequenceEditorPanel';

const AddContactsDialog = lazy(() => import('./AddContactsDialog'));

// ─── Tab config ───────────────────────────────────────────────────────────────

type Tab = 'sequence' | 'contacts' | 'analytics';
const TAB_VALUES = ['sequence', 'contacts', 'analytics'] as const;
const tabParser = parseAsStringLiteral(TAB_VALUES).withDefault('sequence');

const TABS: { id: Tab; label: string }[] = [
  { id: 'sequence', label: 'Sequence Editor' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'analytics', label: 'Analytics' },
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
  const [addContactsOpen, setAddContactsOpen] = useState(false);
  const saveSequenceRef = useRef<{ save: () => void } | null>(null);
  const [isSavingSequence, setIsSavingSequence] = useState(false);

  const { data: campaign, isLoading } = useQuery(getZukoCampaignByDbId(zukoId));

  const approveMutation = useMutation({
    mutationFn: () => apolloSequencesApi.approve(campaign!.providerSequenceId!),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['campaign', 'zuko-db', zukoId],
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

  const {
    data: sequenceContacts = [],
    isLoading: isLoadingContacts,
    refetch: refetchContacts,
  } = useQuery({
    queryKey: ['sequence-contacts', campaign.providerSequenceId],
    queryFn: () =>
      apolloProspectsApi.getSequenceContacts(campaign.providerSequenceId!),
    enabled: hasSequence && activeTab === 'contacts',
    staleTime: 0,
  });

  const contactColumns = useMemo<ColumnDef<SequenceContact>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ getValue }) => getValue<string>() ?? '—',
      },
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ getValue }) => getValue<string>() ?? '—',
      },
      {
        accessorKey: 'organizationName',
        header: 'Company',
        cell: ({ getValue }) => getValue<string>() ?? '—',
      },
      {
        accessorKey: 'sequenceStatus',
        header: 'Status',
        cell: ({ getValue }) => {
          const s = getValue<string>();
          if (!s) return '—';
          return (
            <Badge
              color={
                s === 'active'
                  ? 'green'
                  : s === 'finished'
                    ? 'blue'
                    : s === 'paused'
                      ? 'yellow'
                      : 'zinc'
              }
            >
              {s}
            </Badge>
          );
        },
      },
    ],
    [],
  );

  return (
    <>
      <div className="flex min-h-0 flex-col">
        <BackLink
          href={
            campaign.icpProfileId
              ? `/icps/${campaign.icpProfileId}?tab=campaigns`
              : '/icps'
          }
        >
          {campaign.icpProfileId ? 'Back to ICP' : 'ICP Profiles'}
        </BackLink>

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
            {activeTab === 'contacts' && hasSequence && (
              <Button color="dark" onClick={() => setAddContactsOpen(true)}>
                Add Contacts
              </Button>
            )}
            {hasSequence &&
              (campaign.active ? (
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

            {/* Contacts tab */}
            {activeTab === 'contacts' && (
              <div>
                {hasSequence && (
                  <div className="mb-3 flex justify-end">
                    <Button outline onClick={() => void refetchContacts()}>
                      Refresh
                    </Button>
                  </div>
                )}
                {!hasSequence ? (
                  <div className="rounded-xl border border-zinc-700/60 bg-zinc-900 p-8 text-center">
                    <Text className="text-sm text-zinc-400">
                      Save your sequence first to add contacts.
                    </Text>
                    <Button
                      className="mt-4"
                      outline
                      onClick={() => setActiveTab('sequence')}
                    >
                      Go to Sequence Editor
                    </Button>
                  </div>
                ) : (
                  <BaseTable<SequenceContact>
                    columns={contactColumns}
                    data={sequenceContacts}
                    loading={isLoadingContacts}
                    totalCount={sequenceContacts.length}
                    entityName="contacts"
                    showAddColumn={false}
                    onAddColumn={() => {}}
                    disableRowClick
                    showEmptyState
                    emptyStateConfig={{
                      icon: () => null,
                      title: 'No contacts enrolled',
                      description:
                        'Use "Add Contacts" to enroll people into this sequence.',
                      action: {
                        label: 'Add Contacts',
                        onClick: () => setAddContactsOpen(true),
                      },
                    }}
                  />
                )}
              </div>
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
                <Badge color={campaign.active ? 'green' : 'zinc'}>
                  {campaign.active ? 'Active' : 'Inactive'}
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
                  className="mt-1 block text-sm text-blue-400 hover:underline"
                >
                  View ICP →
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
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        {addContactsOpen && campaign.providerSequenceId && (
          <AddContactsDialog
            sequenceId={campaign.providerSequenceId}
            open={addContactsOpen}
            onClose={() => {
              setAddContactsOpen(false);
              void refetchContacts();
            }}
          />
        )}
      </Suspense>
    </>
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

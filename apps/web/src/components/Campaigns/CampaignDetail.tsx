'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Heading,
  Select,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  Text,
} from '@zuko/ui-kit';
import { PlusIcon, TrashIcon } from '@heroicons/react/20/solid';
import { getCampaignById, getZukoCampaign } from '@/server/query-options';
import {
  apolloSequencesApi,
  type ZukoCampaign,
  type CreateSequencePayload,
} from '@/lib/api/apollo';
import { BackLink, LoadingState } from '@/components/shared';
import { toast } from 'sonner';
import dayjs from 'dayjs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StepFormState {
  apolloStepId?: string;
  type: 'auto_email' | 'manual_email';
  waitTime: number;
  waitMode: 'day' | 'hour' | 'minute';
  apolloTouchId?: string;
  apolloTemplateId?: string;
  subject: string;
  bodyHtml: string;
  includeSignature: boolean;
  status: 'approved' | 'to_be_reviewed';
  hasPersonalizedOpener: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VARIABLES = [
  '{{first_name}}',
  '{{last_name}}',
  '{{company}}',
  '{{title}}',
  '{{email}}',
  '{{city}}',
  '{{country}}',
];

function campaignToSteps(campaign: ZukoCampaign): StepFormState[] {
  return campaign.sequence.map((step) => {
    const touch = step.emailer_touches[0];
    return {
      apolloStepId: step.id,
      type: step.type as 'auto_email' | 'manual_email',
      waitTime: step.wait_time,
      waitMode: step.wait_mode as 'day' | 'hour' | 'minute',
      apolloTouchId: touch?.id,
      apolloTemplateId: touch?.emailer_template_id,
      subject: touch?.emailer_template?.subject ?? '',
      bodyHtml: touch?.emailer_template?.body_html ?? '',
      includeSignature: touch?.include_signature ?? true,
      status: (touch?.status as 'approved' | 'to_be_reviewed') ?? 'approved',
      hasPersonalizedOpener: touch?.has_personalized_opener ?? false,
    };
  });
}

function stepsToPayload(
  steps: StepFormState[],
  name: string,
  permissions: string,
): CreateSequencePayload {
  return {
    name,
    permissions: permissions as 'private' | 'team_can_view' | 'team_can_use',
    sequence: steps.map((step) => ({
      ...(step.apolloStepId && { apolloStepId: step.apolloStepId }),
      type: step.type,
      waitTime: step.waitTime,
      waitMode: step.waitMode,
      touches: [
        {
          ...(step.apolloTouchId && { apolloTouchId: step.apolloTouchId }),
          ...(step.apolloTemplateId && {
            apolloTemplateId: step.apolloTemplateId,
          }),
          type: 'new_thread' as const,
          emailerTemplate: {
            ...(step.subject && { subject: step.subject }),
            bodyHtml: step.bodyHtml,
          },
          includeSignature: step.includeSignature,
          status: step.status,
          hasPersonalizedOpener: step.hasPersonalizedOpener,
        },
      ],
    })),
  };
}

function formatRate(value: number | string): string {
  if (value === 'loading' || value === undefined || value === null) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? '—' : `${(num * 100).toFixed(1)}%`;
}

function formatWait(waitTime: number, waitMode: string): string {
  if (waitTime === 0) return 'immediately';
  return `${waitTime} ${waitMode}${waitTime !== 1 ? 's' : ''}`;
}

function defaultStep(): StepFormState {
  return {
    type: 'auto_email',
    waitTime: 1,
    waitMode: 'day',
    subject: '',
    bodyHtml: '',
    includeSignature: true,
    status: 'approved',
    hasPersonalizedOpener: false,
  };
}

// ─── Variable chips ────────────────────────────────────────────────────────

function VariableChips({ onInsert }: { onInsert: (variable: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {VARIABLES.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onInsert(v)}
          className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
        >
          {v}
        </button>
      ))}
    </div>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────

interface StepCardProps {
  index: number;
  step: StepFormState;
  canRemove: boolean;
  onChange: (updated: StepFormState) => void;
  onRemove: () => void;
  disabled: boolean;
}

function StepCard({
  index,
  step,
  canRemove,
  onChange,
  onRemove,
  disabled,
}: StepCardProps) {
  const update = (patch: Partial<StepFormState>) =>
    onChange({ ...step, ...patch });

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [lastFocused, setLastFocused] = useState<'subject' | 'body'>('body');

  const insertVariable = (variable: string) => {
    if (lastFocused === 'subject' && subjectRef.current) {
      const el = subjectRef.current;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const newVal = el.value.slice(0, start) + variable + el.value.slice(end);
      update({ subject: newVal });
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else if (bodyRef.current) {
      const el = bodyRef.current;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const newVal = el.value.slice(0, start) + variable + el.value.slice(end);
      update({ bodyHtml: newVal });
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-900 overflow-hidden">
      {/* Step header */}
      <div className="flex items-center gap-3 border-b border-zinc-700/60 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Step {index + 1}
        </span>

        {/* Type toggle */}
        <div className="flex items-center overflow-hidden rounded-md border border-zinc-700 text-xs">
          <button
            type="button"
            disabled={disabled}
            onClick={() => update({ type: 'auto_email' })}
            className={`px-3 py-1.5 font-medium transition-colors ${
              step.type === 'auto_email'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Auto Email
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => update({ type: 'manual_email' })}
            className={`px-3 py-1.5 font-medium transition-colors ${
              step.type === 'manual_email'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Manual Email
          </button>
        </div>

        {/* Wait time */}
        <div className="flex items-center gap-1 text-xs text-zinc-400">
          <span>Wait</span>
          <input
            type="number"
            min={0}
            value={step.waitTime}
            disabled={disabled}
            onChange={(e) => update({ waitTime: Number(e.target.value) })}
            className="w-10 rounded border-0 bg-transparent text-center text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600 [appearance:textfield]"
          />
          <select
            value={step.waitMode}
            disabled={disabled}
            onChange={(e) =>
              update({ waitMode: e.target.value as 'day' | 'hour' | 'minute' })
            }
            className="bg-transparent text-zinc-400 focus:outline-none text-xs cursor-pointer"
          >
            <option value="day">day(s)</option>
            <option value="hour">hour(s)</option>
            <option value="minute">minute(s)</option>
          </select>
          {step.waitTime === 0 && (
            <span className="italic text-zinc-500">immediately</span>
          )}
        </div>

        <div className="ml-auto">
          {canRemove && (
            <button
              type="button"
              disabled={disabled}
              onClick={onRemove}
              className="text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-40"
            >
              <TrashIcon className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Email content */}
      <div className="p-4 space-y-4">
        {/* Variant label */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-blue-400 border-b-2 border-blue-400 pb-0.5">
            Variant A
          </span>
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-200">Subject</label>
          <input
            ref={subjectRef}
            type="text"
            value={step.subject}
            disabled={disabled}
            onFocus={() => setLastFocused('subject')}
            onChange={(e) => update({ subject: e.target.value })}
            placeholder="e.g. Hello {{first_name}},"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-60"
          />
          <VariableChips onInsert={insertVariable} />
        </div>

        {/* Body */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-200">Body</label>
          <textarea
            ref={bodyRef}
            value={step.bodyHtml}
            disabled={disabled}
            onFocus={() => setLastFocused('body')}
            onChange={(e) => update({ bodyHtml: e.target.value })}
            placeholder="Write your email body here…"
            rows={8}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-60 resize-none"
          />
          <VariableChips onInsert={insertVariable} />
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-6 pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Switch
              checked={step.includeSignature}
              onChange={(val) => update({ includeSignature: val })}
              disabled={disabled}
              color="dark/zinc"
            />
            <span className="text-sm text-zinc-300">Include signature</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Switch
              checked={step.status === 'approved'}
              onChange={(val) =>
                update({ status: val ? 'approved' : 'to_be_reviewed' })
              }
              disabled={disabled}
              color="dark/zinc"
            />
            <span className="text-sm text-zinc-300">Approved</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Switch
              checked={step.hasPersonalizedOpener}
              onChange={(val) => update({ hasPersonalizedOpener: val })}
              disabled={disabled}
              color="dark/zinc"
            />
            <span className="text-sm text-zinc-300">
              AI personalised opener
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

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

  // Re-initialize when Zuko campaign loads
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
    const payload = stepsToPayload(steps, campaign.name, permissions);
    updateMutation.mutate(payload);
  };

  const addStep = () => setSteps((prev) => [...prev, defaultStep()]);
  const removeStep = (i: number) =>
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  const updateStep = (i: number, updated: StepFormState) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? updated : s)));

  return (
    <div className="flex min-h-0 flex-col">
      {/* Page header */}
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

      {/* Tabs */}
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

      {/* Tab content */}
      <div className="mt-6 flex-1">
        {/* Editor tab */}
        {activeTabIndex === 0 && (
          <div className="flex gap-8 items-start">
            {/* Step editor */}
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
                      key={i}
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

              {/* Add step button */}
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
              {/* Settings */}
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

              {/* Campaign details */}
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

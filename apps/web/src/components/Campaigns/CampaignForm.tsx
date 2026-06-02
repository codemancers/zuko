'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Button,
  Field,
  FieldGroup,
  Label,
  ErrorMessage,
  Input,
  Select,
  SheetFooter,
} from '@zuko/ui-kit';
import { PlusIcon, TrashIcon } from '@heroicons/react/20/solid';
import {
  apolloSequencesApi,
  type ZukoCampaign,
  type CreateSequenceStep,
  type CreateSequencePayload,
} from '@/lib/api/apollo';
import { PageHeader, BackLink } from '@/components/shared';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StepFormState {
  apolloStepId?: string;
  type: 'auto_email' | 'manual_email';
  waitTime: number;
  waitMode: 'day' | 'hour' | 'minute';
  apolloTouchId?: string;
  apolloTemplateId?: string;
  subject: string;
  bodyHtml: string;
}

interface CampaignFormProps {
  mode: 'create' | 'edit';
  campaign?: ZukoCampaign;
  /** When rendered inside a Sheet, pass these to use SheetFooter and skip page chrome */
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

function defaultStep(): StepFormState {
  return {
    type: 'auto_email',
    waitTime: 1,
    waitMode: 'day',
    subject: '',
    bodyHtml: '',
  };
}

function campaignToSteps(campaign: ZukoCampaign): StepFormState[] {
  return campaign.sequence.map((step) => ({
    apolloStepId: step.id,
    type: step.type as 'auto_email' | 'manual_email',
    waitTime: step.wait_time,
    waitMode: step.wait_mode as 'day' | 'hour' | 'minute',
    apolloTouchId: step.emailer_touches[0]?.id,
    apolloTemplateId: step.emailer_touches[0]?.emailer_template_id,
    subject: step.emailer_touches[0]?.emailer_template?.subject ?? '',
    bodyHtml: step.emailer_touches[0]?.emailer_template?.body_html ?? '',
  }));
}

function stepsToPayload(steps: StepFormState[]): CreateSequenceStep[] {
  return steps.map((step) => ({
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
      },
    ],
  }));
}

// ─── Step Card ───────────────────────────────────────────────────────────────

interface StepCardProps {
  index: number;
  step: StepFormState;
  errors: Record<string, string>;
  canRemove: boolean;
  onChange: (updated: StepFormState) => void;
  onRemove: () => void;
  disabled: boolean;
}

function StepCard({
  index,
  step,
  errors,
  canRemove,
  onChange,
  onRemove,
  disabled,
}: StepCardProps) {
  const update = (patch: Partial<StepFormState>) =>
    onChange({ ...step, ...patch });

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Step {index + 1}
          </span>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="text-zinc-400 hover:text-red-500 disabled:opacity-50 transition-colors"
            aria-label="Remove step"
          >
            <TrashIcon className="size-4" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        <Field>
          <Label>Type</Label>
          <Select
            value={step.type}
            onChange={(e) =>
              update({ type: e.target.value as 'auto_email' | 'manual_email' })
            }
            disabled={disabled}
          >
            <option value="auto_email">Auto Email</option>
            <option value="manual_email">Manual Email</option>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <Label>Wait time</Label>
            <Input
              type="number"
              min={0}
              value={step.waitTime}
              onChange={(e) => update({ waitTime: Number(e.target.value) })}
              disabled={disabled}
            />
          </Field>
          <Field>
            <Label>Unit</Label>
            <Select
              value={step.waitMode}
              onChange={(e) =>
                update({
                  waitMode: e.target.value as 'day' | 'hour' | 'minute',
                })
              }
              disabled={disabled}
            >
              <option value="day">Day(s)</option>
              <option value="hour">Hour(s)</option>
              <option value="minute">Minute(s)</option>
            </Select>
          </Field>
        </div>
      </div>

      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Email
        </p>
        <Field>
          <Label>Subject</Label>
          <Input
            value={step.subject}
            onChange={(e) => update({ subject: e.target.value })}
            placeholder="e.g. Quick question about {{company}}"
            disabled={disabled}
          />
        </Field>
        <Field>
          <Label>Body (HTML) *</Label>
          <textarea
            value={step.bodyHtml}
            onChange={(e) => update({ bodyHtml: e.target.value })}
            placeholder="<p>Hi {{first_name}},</p><p>…</p>"
            disabled={disabled}
            rows={6}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-600"
          />
          {errors[`step_${index}_bodyHtml`] && (
            <ErrorMessage>{errors[`step_${index}_bodyHtml`]}</ErrorMessage>
          )}
        </Field>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CampaignForm({
  mode,
  campaign,
  onSuccess,
  onCancel,
}: CampaignFormProps) {
  const inSheet = !!(onSuccess || onCancel);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState(campaign?.name ?? '');
  const [permissions, setPermissions] = useState<
    'private' | 'team_can_view' | 'team_can_use'
  >((campaign?.permissions as 'private' | 'team_can_view' | 'team_can_use') ?? 'team_can_use');
  const [emailerScheduleId, setEmailerScheduleId] = useState('');
  const [steps, setSteps] = useState<StepFormState[]>(
    campaign ? campaignToSteps(campaign) : [defaultStep()],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: schedulesData, isLoading: isLoadingSchedules } = useQuery({
    queryKey: ['apollo', 'schedules'],
    queryFn: () => apolloSequencesApi.getSchedules(),
    staleTime: Infinity,
  });
  const schedules = schedulesData?.emailer_schedules ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: CreateSequencePayload) =>
      apolloSequencesApi.create(payload),
    onSuccess: () => {
      toast.success('Campaign created — list will refresh in a moment');
      if (inSheet) {
        onSuccess?.();
      } else {
        router.push('/campaigns');
      }
      // Apollo's search index has a short delay before new sequences appear
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['campaigns', 'infinite'] });
      }, 3000);
    },
    onError: () => toast.error('Failed to create campaign'),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: CreateSequencePayload) =>
      apolloSequencesApi.update(campaign!.providerSequenceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'infinite'] });
      queryClient.invalidateQueries({
        queryKey: ['campaign', campaign!.providerSequenceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['campaign', 'zuko', campaign!.providerSequenceId],
      });
      toast.success('Campaign updated');
      if (inSheet) {
        onSuccess?.();
      } else {
        router.push(`/campaigns/${campaign!.providerSequenceId}`);
      }
    },
    onError: () => toast.error('Failed to update campaign'),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors['name'] = 'Name is required';
    if (steps.length === 0) newErrors['steps'] = 'At least one step is required';
    steps.forEach((step, i) => {
      if (!step.bodyHtml.trim())
        newErrors[`step_${i}_bodyHtml`] = 'Email body is required';
    });
    return newErrors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const payload: CreateSequencePayload = {
      name: name.trim(),
      permissions,
      ...(emailerScheduleId && { emailerScheduleId }),
      sequence: stepsToPayload(steps),
    };

    if (mode === 'create') createMutation.mutate(payload);
    else updateMutation.mutate(payload);
  };

  const addStep = () => setSteps((prev) => [...prev, defaultStep()]);
  const removeStep = (index: number) =>
    setSteps((prev) => prev.filter((_, i) => i !== index));
  const updateStep = (index: number, updated: StepFormState) =>
    setSteps((prev) => prev.map((s, i) => (i === index ? updated : s)));

  return (
    <div className={inSheet ? undefined : 'mx-auto max-w-3xl'}>
      {!inSheet && (
        <>
          <BackLink href="/campaigns">Campaigns</BackLink>
          <div className="mt-4">
            <PageHeader
              title={mode === 'create' ? 'New Campaign' : 'Edit Campaign'}
              description={
                mode === 'create'
                  ? 'Create an Apollo email sequence with one or more steps.'
                  : 'Update this sequence. Changes will be synced to Apollo.'
              }
            />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className={inSheet ? 'flex flex-col gap-6' : 'mt-8 space-y-8'}>
        {/* Campaign Details */}
        <FieldGroup>
          <Field>
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q3 Outbound – SaaS Mid-Market"
              disabled={isPending}
            />
            {errors['name'] && <ErrorMessage>{errors['name']}</ErrorMessage>}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label>Permissions</Label>
              <Select
                value={permissions}
                onChange={(e) =>
                  setPermissions(
                    e.target.value as 'private' | 'team_can_view' | 'team_can_use',
                  )
                }
                disabled={isPending}
              >
                <option value="team_can_use">Team Can Use</option>
                <option value="team_can_view">Team Can View</option>
                <option value="private">Private</option>
              </Select>
            </Field>

            <Field>
              <Label>Email Schedule</Label>
              <Select
                value={emailerScheduleId}
                onChange={(e) => setEmailerScheduleId(e.target.value)}
                disabled={isPending || isLoadingSchedules}
              >
                <option value="">
                  {isLoadingSchedules ? 'Loading…' : 'Default schedule'}
                </option>
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.default ? ' (default)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </FieldGroup>

        {/* Sequence Builder */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                Sequence Steps
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Each step sends one email. Steps run in order with the specified
                wait time.
              </p>
            </div>
          </div>

          {errors['steps'] && (
            <p className="mb-3 text-sm text-red-600 dark:text-red-400">
              {errors['steps']}
            </p>
          )}

          <div className="space-y-4">
            {steps.map((step, index) => (
              <StepCard
                key={index}
                index={index}
                step={step}
                errors={errors}
                canRemove={steps.length > 1}
                onChange={(updated) => updateStep(index, updated)}
                onRemove={() => removeStep(index)}
                disabled={isPending}
              />
            ))}
          </div>

          <Button
            type="button"
            outline
            onClick={addStep}
            disabled={isPending}
            className="mt-4"
          >
            <PlusIcon className="size-4" />
            Add Step
          </Button>
        </div>

        {/* Actions */}
        {inSheet ? (
          <SheetFooter>
            <Button
              type="button"
              plain
              onClick={onCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" color="dark" disabled={isPending}>
              {isPending
                ? mode === 'create'
                  ? 'Creating…'
                  : 'Saving…'
                : mode === 'create'
                  ? 'Create Campaign'
                  : 'Save Changes'}
            </Button>
          </SheetFooter>
        ) : (
          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-700">
            <Button
              type="button"
              plain
              onClick={() => router.back()}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" color="dark" disabled={isPending}>
              {isPending
                ? mode === 'create'
                  ? 'Creating…'
                  : 'Saving…'
                : mode === 'create'
                  ? 'Create Campaign'
                  : 'Save Changes'}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}

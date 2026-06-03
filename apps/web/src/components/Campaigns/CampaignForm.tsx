'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Button,
  ErrorMessage,
  Field,
  Input,
  Label,
  Select,
  Switch,
  Textarea,
  cn,
} from '@zuko/ui-kit';
import { PlusIcon, TrashIcon } from '@heroicons/react/20/solid';
import {
  apolloSequencesApi,
  type ZukoCampaign,
  type CreateSequenceStep,
  type CreateSequencePayload,
} from '@/lib/api/apollo';
import { BackLink } from '@/components/shared';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StepFormState {
  stableKey: string;
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

interface CampaignFormProps {
  mode: 'create' | 'edit';
  campaign?: ZukoCampaign;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

function genKey() {
  return Math.random().toString(36).slice(2);
}

function defaultStep(): StepFormState {
  return {
    stableKey: genKey(),
    type: 'auto_email',
    waitTime: 0,
    waitMode: 'day',
    subject: '',
    bodyHtml: '',
    includeSignature: true,
    status: 'approved',
    hasPersonalizedOpener: false,
  };
}

function campaignToSteps(campaign: ZukoCampaign): StepFormState[] {
  return campaign.sequence.map((step) => {
    const touch = step.emailer_touches[0];
    return {
      stableKey: step.id,
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
        includeSignature: step.includeSignature,
        status: step.status,
        hasPersonalizedOpener: step.hasPersonalizedOpener,
      },
    ],
  }));
}

// ─── Variable chips ───────────────────────────────────────────────────────────

const VARIABLES = [
  '{{first_name}}',
  '{{last_name}}',
  '{{company}}',
  '{{title}}',
  '{{email}}',
  '{{city}}',
  '{{country}}',
];

function VariableChips({ onInsert }: { onInsert: (variable: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
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
            className={cn(
              'px-3 py-1.5 font-medium transition-colors',
              step.type === 'auto_email'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            Auto Email
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => update({ type: 'manual_email' })}
            className={cn(
              'px-3 py-1.5 font-medium transition-colors',
              step.type === 'manual_email'
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-zinc-200',
            )}
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
        <Field>
          <Label>Subject</Label>
          <Input
            ref={subjectRef}
            type="text"
            value={step.subject}
            disabled={disabled}
            onFocus={() => setLastFocused('subject')}
            onChange={(e) => update({ subject: e.target.value })}
            placeholder="e.g. Hello {{first_name}},"
            data-invalid={errors[`step_${index}_subject`] ? true : undefined}
          />
          {errors[`step_${index}_subject`] && (
            <ErrorMessage>{errors[`step_${index}_subject`]}</ErrorMessage>
          )}
          <VariableChips onInsert={insertVariable} />
        </Field>

        {/* Body */}
        <Field>
          <Label>Body</Label>
          <Textarea
            ref={bodyRef}
            value={step.bodyHtml}
            disabled={disabled}
            onFocus={() => setLastFocused('body')}
            onChange={(e) => update({ bodyHtml: e.target.value })}
            placeholder="Write your email body here…"
            rows={8}
            className="[&_textarea]:resize-none"
            data-invalid={errors[`step_${index}_bodyHtml`] ? true : undefined}
          />
          {errors[`step_${index}_bodyHtml`] && (
            <ErrorMessage>{errors[`step_${index}_bodyHtml`]}</ErrorMessage>
          )}
          <VariableChips onInsert={insertVariable} />
        </Field>

        {/* Toggles */}
        <div className="flex items-center gap-6 pt-1">
          <div className="flex items-center gap-2 cursor-pointer select-none">
            <Switch
              checked={step.includeSignature}
              onChange={(val) => update({ includeSignature: val })}
              disabled={disabled}
              color="dark/zinc"
            />
            <span className="text-sm text-zinc-300">Include signature</span>
          </div>

          <div className="flex items-center gap-2 cursor-pointer select-none">
            <Switch
              checked={step.status === 'approved'}
              onChange={(val) =>
                update({ status: val ? 'approved' : 'to_be_reviewed' })
              }
              disabled={disabled}
              color="dark/zinc"
            />
            <span className="text-sm text-zinc-300">Approved</span>
          </div>

          <div className="flex items-center gap-2 cursor-pointer select-none">
            <Switch
              checked={step.hasPersonalizedOpener}
              onChange={(val) => update({ hasPersonalizedOpener: val })}
              disabled={disabled}
              color="dark/zinc"
            />
            <span className="text-sm text-zinc-300">
              AI personalised opener
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CampaignForm({ mode, campaign }: CampaignFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState(campaign?.name ?? '');
  const [permissions, setPermissions] = useState<string>(
    campaign?.permissions ?? 'team_can_use',
  );
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
    onSuccess: (data) => {
      const campaignId = data?.emailer_campaign?.id;
      if (data?.emailer_campaign && campaignId) {
        // Seed the detail cache so the detail page renders immediately
        // without waiting for Apollo's search index to catch up
        queryClient.setQueryData(
          ['campaign', campaignId],
          data.emailer_campaign,
        );
      }
      toast.success('Campaign created successfully');
      if (campaignId) {
        router.push(`/campaigns/${campaignId}`);
      } else {
        router.push('/campaigns');
      }
      // Invalidate the list after a delay (Apollo search index lag)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['campaigns', 'infinite'] });
      }, 5000);
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
      router.push(`/campaigns/${campaign!.providerSequenceId}`);
    },
    onError: () => toast.error('Failed to update campaign'),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors['name'] = 'Name is required';
    if (steps.length === 0)
      newErrors['steps'] = 'At least one step is required';
    steps.forEach((step, i) => {
      if (!step.subject.trim())
        newErrors[`step_${i}_subject`] = 'Subject is required';
      if (!step.bodyHtml.trim())
        newErrors[`step_${i}_bodyHtml`] = 'Email body is required';
    });
    return newErrors;
  };

  const handleSubmit = () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const payload: CreateSequencePayload = {
      name: name.trim(),
      permissions: permissions as 'private' | 'team_can_view' | 'team_can_use',
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
    <div className="flex min-h-0 flex-col">
      {/* Back link */}
      <BackLink href="/campaigns">Campaigns</BackLink>

      {/* Page header */}
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Field>
            <Input
              variant="plain"
              className="w-full [&_input]:text-2xl [&_input]:font-bold [&_input]:text-zinc-900 [&_input]:dark:text-white [&_input]:placeholder-zinc-400"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Campaign name…"
              disabled={isPending}
            />
            {errors['name'] && <ErrorMessage>{errors['name']}</ErrorMessage>}
          </Field>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            plain
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            color="dark"
            disabled={isPending || steps.length === 0}
            onClick={handleSubmit}
          >
            {isPending
              ? mode === 'create'
                ? 'Creating…'
                : 'Saving…'
              : mode === 'create'
                ? 'Create Campaign'
                : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="mt-6 flex gap-8 items-start">
        {/* Steps editor */}
        <div className="min-w-0 flex-1">
          {errors['steps'] && (
            <p className="mb-3 text-sm text-red-500">{errors['steps']}</p>
          )}

          <div className="space-y-4">
            {steps.map((step, index) => (
              <StepCard
                key={step.stableKey}
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

          {/* Add step */}
          <button
            type="button"
            onClick={addStep}
            disabled={isPending}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 py-4 text-sm text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
          >
            <PlusIcon className="size-4" />
            Add step
          </button>
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
                disabled={isPending}
              >
                <option value="team_can_use">Team can use</option>
                <option value="team_can_view">Team can view</option>
                <option value="private">Private</option>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-zinc-500">
                Schedule
              </p>
              <Select
                value={emailerScheduleId}
                onChange={(e) => setEmailerScheduleId(e.target.value)}
                disabled={isPending || isLoadingSchedules}
              >
                <option value="">
                  {isLoadingSchedules ? 'Loading…' : 'Default'}
                </option>
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.default ? ' (default)' : ''}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

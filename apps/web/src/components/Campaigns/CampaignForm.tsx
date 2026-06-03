'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button, ErrorMessage, Field, Input, Select } from '@zuko/ui-kit';
import { PlusIcon } from '@heroicons/react/20/solid';
import {
  apolloSequencesApi,
  type ZukoCampaign,
  type CreateSequencePayload,
} from '@/lib/api/apollo';
import { BackLink } from '@/components/shared';
import { toast } from 'sonner';
import {
  StepCard,
  type StepFormState,
  campaignToSteps,
  defaultStep,
  stepsToPayload,
} from './campaign-shared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CampaignFormProps {
  mode: 'create' | 'edit';
  campaign?: ZukoCampaign;
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
      <BackLink href="/campaigns">Campaigns</BackLink>

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

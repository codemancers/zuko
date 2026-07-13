'use client';

import { useRef, useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@zuko/ui-kit';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { OutputData } from '@editorjs/editorjs';
import Editor, { ensureOutputData } from '@/components/Common/Editor/Editor';
import { apolloSequencesApi, type ZukoCampaign } from '@/lib/api/apollo';
import { toast } from 'sonner';
import {
  type StepFormState,
  campaignToSteps,
  defaultStep,
  stepsToPayload,
  outputDataToHtml,
} from './campaign-shared';

// ─── Step card ────────────────────────────────────────────────────────────────

const metaControl =
  'rounded-md bg-transparent px-1.5 py-0.5 text-xs text-zinc-600 outline-none hover:bg-zinc-100 focus:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800';

function StepCard({
  step,
  index,
  disabled,
  showDelete,
  onUpdate,
  onRemove,
}: {
  step: StepFormState;
  index: number;
  disabled: boolean;
  showDelete: boolean;
  onUpdate: (i: number, patch: Partial<StepFormState>) => void;
  onRemove: (i: number) => void;
}) {
  const onEditorChangeRef = useRef<(data: OutputData) => void>(() => {});
  onEditorChangeRef.current = (data: OutputData) => {
    onUpdate(index, { bodyHtml: outputDataToHtml(data) });
  };

  const isReply = step.touchType === 'reply_to_thread';

  return (
    <div className="rounded-xl bg-white dark:bg-zinc-900">
      {/* Meta bar: step number, type + wait inline, delete */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Step {index + 1}
        </span>

        <span className="text-zinc-300 dark:text-zinc-600">·</span>

        <select
          className={metaControl}
          value={step.touchType}
          disabled={disabled}
          onChange={(e) =>
            onUpdate(index, {
              touchType: e.target.value as 'new_thread' | 'reply_to_thread',
            })
          }
        >
          <option value="new_thread">New thread</option>
          <option value="reply_to_thread">Reply to thread</option>
        </select>

        <span className="text-zinc-300 dark:text-zinc-600">·</span>

        <span className="text-xs text-zinc-400 dark:text-zinc-500">wait</span>
        <input
          type="number"
          min={0}
          className={`${metaControl} w-12 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`}
          value={step.waitTime}
          disabled={disabled}
          onChange={(e) =>
            onUpdate(index, { waitTime: Math.max(0, Number(e.target.value)) })
          }
        />
        <select
          className={metaControl}
          value={step.waitMode}
          disabled={disabled}
          onChange={(e) =>
            onUpdate(index, {
              waitMode: e.target.value as 'day' | 'hour' | 'minute',
            })
          }
        >
          <option value="day">days</option>
          <option value="hour">hours</option>
          <option value="minute">mins</option>
        </select>

        {showDelete && (
          <div className="ml-auto">
            <Button
              plain
              disabled={disabled}
              onClick={() => onRemove(index)}
              aria-label={`Delete step ${index + 1}`}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Subject line */}
      {!isReply && (
        <input
          type="text"
          className="w-full border-b border-zinc-100 bg-transparent py-2.5 pr-4 pl-10 text-sm font-medium text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-50 dark:border-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
          value={step.subject}
          disabled={disabled}
          onChange={(e) => onUpdate(index, { subject: e.target.value })}
          placeholder="Subject"
        />
      )}

      {/* Body — borderless, document-style */}
      <div className="min-h-40 py-3 pr-4 pl-10 text-zinc-800 dark:text-zinc-200">
        <Editor
          holder={`step-editor-${step.stableKey}`}
          data={ensureOutputData(step.bodyHtml)}
          onChange={(data) => onEditorChangeRef.current(data)}
          onReady={(instance) => {
            instance
              .save()
              .then((data) => onEditorChangeRef.current(data))
              .catch(() => null);
          }}
          readOnly={disabled}
          placeholder="Write your email…"
        />
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function SequenceEditorPanel({
  campaign,
  actionRef,
  onPendingChange,
}: {
  campaign: ZukoCampaign;
  actionRef?: React.MutableRefObject<{ save: () => void } | null>;
  onPendingChange?: (isPending: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const [steps, setSteps] = useState<StepFormState[]>(() =>
    campaign.sequence?.length ? campaignToSteps(campaign) : [defaultStep()],
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      apolloSequencesApi.saveSequenceForCampaign(campaign.id, {
        sequence: stepsToPayload(steps),
        permissions: campaign.permissions as
          | 'private'
          | 'team_can_view'
          | 'team_can_use',
      }),
    onSuccess: () => {
      toast.success('Sequence saved');
      queryClient.invalidateQueries({
        queryKey: ['campaign', 'zuko-db', campaign.id],
      });
      if (campaign.icpProfileId) {
        queryClient.invalidateQueries({
          queryKey: ['campaigns', 'by-icp', campaign.icpProfileId],
        });
      }
    },
    onError: () => toast.error('Failed to save sequence'),
  });

  const updateStep = (index: number, patch: Partial<StepFormState>) =>
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );

  const removeStep = (index: number) =>
    setSteps((prev) => prev.filter((_, i) => i !== index));

  const addStep = () => setSteps((prev) => [...prev, defaultStep()]);

  const isPending = saveMutation.isPending;

  useEffect(() => {
    if (actionRef) actionRef.current = { save: () => saveMutation.mutate() };
  });

  useEffect(() => {
    onPendingChange?.(isPending);
  }, [isPending, onPendingChange]);

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <StepCard
          key={step.stableKey}
          step={step}
          index={index}
          disabled={isPending}
          showDelete={steps.length > 1}
          onUpdate={updateStep}
          onRemove={removeStep}
        />
      ))}

      <Button outline disabled={isPending} onClick={addStep}>
        <PlusIcon className="h-4 w-4" />
        Add step
      </Button>
    </div>
  );
}

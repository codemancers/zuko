'use client';

import { useRef, useMemo, useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  Checkbox,
  Field,
  Input,
  Label,
  Select,
  Sheet,
  SheetBody,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
} from '@zuko/ui-kit';
import { Squares2X2Icon, XMarkIcon } from '@heroicons/react/24/outline';
import type { OutputData } from '@editorjs/editorjs';
import type EditorJS from '@editorjs/editorjs';
import Editor, { ensureOutputData } from '@/components/Common/Editor/Editor';
import { apolloSequencesApi, type ZukoCampaign } from '@/lib/api/apollo';
import {
  BaseTable,
  TableActions,
  TableActionButton,
  DeleteAction,
} from '@/components/Table';
import { toast } from 'sonner';
import {
  type StepFormState,
  campaignToSteps,
  defaultStep,
  stepsToPayload,
  outputDataToHtml,
} from './campaign-shared';

type StepRow = StepFormState & { id: string };

// ─── Inline wait cell ─────────────────────────────────────────────────────────

function WaitCell({
  step,
  index,
  disabled,
  onUpdate,
}: {
  step: StepFormState;
  index: number;
  disabled: boolean;
  onUpdate: (i: number, patch: Partial<StepFormState>) => void;
}) {
  const [editing, setEditing] = useState(false);

  const modeLabel =
    step.waitMode === 'day'
      ? 'days'
      : step.waitMode === 'hour'
        ? 'hours'
        : 'mins';

  if (!editing) {
    return (
      <span
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setEditing(true);
        }}
        className="cursor-text text-sm text-zinc-900 dark:text-white hover:underline decoration-dotted underline-offset-2"
      >
        {step.waitTime} {modeLabel}
      </span>
    );
  }

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-16">
        <Input
          type="number"
          min={0}
          value={step.waitTime}
          autoFocus
          disabled={disabled}
          onChange={(e) =>
            onUpdate(index, { waitTime: Math.max(0, Number(e.target.value)) })
          }
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
        />
      </div>
      <div className="w-24">
        <Select
          value={step.waitMode}
          disabled={disabled}
          onChange={(e) => {
            onUpdate(index, {
              waitMode: e.target.value as 'day' | 'hour' | 'minute',
            });
          }}
          onBlur={() => setEditing(false)}
        >
          <option value="day">days</option>
          <option value="hour">hours</option>
          <option value="minute">mins</option>
        </Select>
      </div>
    </div>
  );
}

// ─── Step editor sheet ────────────────────────────────────────────────────────

function StepEditorSheet({
  step,
  open,
  onClose,
  onChange,
  disabled,
}: {
  step: StepFormState | null;
  open: boolean;
  onClose: () => void;
  onChange: (patch: Partial<StepFormState>) => void;
  disabled: boolean;
}) {
  const ejInstanceRef = useRef<EditorJS | null>(null);
  const onEditorChangeRef = useRef<(data: OutputData) => void>(() => {});

  if (!step) return null;

  onEditorChangeRef.current = (data: OutputData) => {
    onChange({ bodyHtml: outputDataToHtml(data) });
  };

  const isReply = step.touchType === 'reply_to_thread';

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader>
        <SheetTitle>Edit Step</SheetTitle>
        <Button plain onClick={onClose}>
          <XMarkIcon className="h-5 w-5" />
        </Button>
      </SheetHeader>
      <SheetBody>
        <div className="space-y-4">
          <Field>
            <Label>Type</Label>
            <Select
              value={step.touchType}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  touchType: e.target.value as 'new_thread' | 'reply_to_thread',
                })
              }
            >
              <option value="new_thread">New thread</option>
              <option value="reply_to_thread">Reply to thread</option>
            </Select>
          </Field>

          {!isReply && (
            <Field>
              <Label>Subject</Label>
              <Input
                type="text"
                value={step.subject}
                disabled={disabled}
                onChange={(e) => onChange({ subject: e.target.value })}
                placeholder="e.g. Hello {{first_name}},"
              />
            </Field>
          )}

          <Field>
            <Label>Email body</Label>
            <div className="mt-2 min-h-48 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-2 text-zinc-200">
              <Editor
                holder={`sheet-editor-${step.stableKey}`}
                data={ensureOutputData(step.bodyHtml)}
                onChange={(data) => onEditorChangeRef.current(data)}
                onReady={(instance) => {
                  ejInstanceRef.current = instance;
                  instance
                    .save()
                    .then((data) => onEditorChangeRef.current(data))
                    .catch(() => null);
                }}
                readOnly={disabled}
                placeholder="Write your email body here…"
              />
            </div>
          </Field>

          <Field>
            <div className="flex cursor-pointer items-center gap-2 select-none">
              <Checkbox
                checked={step.includeSignature}
                disabled={disabled}
                onChange={(val) => onChange({ includeSignature: val })}
              />
              <Label>Include signature</Label>
            </div>
          </Field>
        </div>
      </SheetBody>
      <SheetFooter>
        <Button color="dark" onClick={onClose}>
          Done
        </Button>
        <Button plain onClick={onClose}>
          Cancel
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

// ─── Column cell components ───────────────────────────────────────────────────

function ActionCell({
  step,
  index,
  onEdit,
}: {
  step: StepRow;
  index: number;
  onEdit: (i: number) => void;
}) {
  const actionLabel =
    step.touchType === 'reply_to_thread' ? 'Follow-up Email' : 'Send Email';
  return (
    <div className="flex items-center gap-2">
      <div className="font-medium text-zinc-900 dark:text-white">
        {actionLabel}
      </div>
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <TableActions>
          <TableActionButton label="Open editor" onClick={() => onEdit(index)}>
            <Squares2X2Icon className="h-4 w-4" />
          </TableActionButton>
        </TableActions>
      </div>
    </div>
  );
}

function StatusCell({
  step,
  index,
  disabled,
  onUpdate,
}: {
  step: StepRow;
  index: number;
  disabled: boolean;
  onUpdate: (i: number, patch: Partial<StepFormState>) => void;
}) {
  const enabled = step.status === 'approved';
  return (
    <div
      className="flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <Switch
        checked={enabled}
        onChange={(val) =>
          onUpdate(index, { status: val ? 'approved' : 'to_be_reviewed' })
        }
        disabled={disabled}
        color="dark/zinc"
      />
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {enabled ? 'Enabled' : 'Disabled'}
      </span>
    </div>
  );
}

function ActionsCell({
  index,
  disabled,
  showDelete,
  onRemove,
}: {
  index: number;
  disabled: boolean;
  showDelete: boolean;
  onRemove: (i: number) => void;
}) {
  if (!showDelete) return null;
  return (
    <TableActions>
      <DeleteAction onClick={() => onRemove(index)} disabled={disabled} />
    </TableActions>
  );
}

function NullIcon() {
  return null;
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function SequenceEditorPanel({
  campaign,
  actionRef,
}: {
  campaign: ZukoCampaign;
  actionRef?: React.MutableRefObject<{ save: () => void } | null>;
}) {
  const queryClient = useQueryClient();

  const [steps, setSteps] = useState<StepFormState[]>(() =>
    campaign.sequence?.length ? campaignToSteps(campaign) : [],
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

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

  const addStep = () => {
    const next = [...steps, defaultStep()];
    setSteps(next);
    setSelectedIndex(next.length - 1);
  };

  const isPending = saveMutation.isPending;

  useEffect(() => {
    if (actionRef) actionRef.current = { save: () => saveMutation.mutate() };
  });

  const stepRows: StepRow[] = useMemo(
    () => steps.map((s) => ({ ...s, id: s.stableKey })),
    [steps],
  );

  const columns: ColumnDef<StepRow>[] = useMemo(
    () => [
      {
        id: 'action',
        header: 'Action',
        cell: ({ row }) => (
          <ActionCell
            step={row.original}
            index={row.index}
            onEdit={setSelectedIndex}
          />
        ),
      },
      {
        id: 'wait',
        header: 'Wait After',
        cell: ({ row }) => (
          <WaitCell
            step={row.original}
            index={row.index}
            disabled={isPending}
            onUpdate={updateStep}
          />
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusCell
            step={row.original}
            index={row.index}
            disabled={isPending}
            onUpdate={updateStep}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <ActionsCell
            index={row.index}
            disabled={isPending}
            showDelete={steps.length > 1}
            onRemove={removeStep}
          />
        ),
      },
    ],
    [steps, isPending, updateStep, removeStep],
  );

  const selectedStep =
    selectedIndex !== null ? (steps[selectedIndex] ?? null) : null;

  return (
    <div className="space-y-4 [&>div]:mt-0">
      <BaseTable<StepRow>
        columns={columns}
        data={stepRows}
        loading={false}
        entityName="steps"
        serialColumnHeader="Step"
        onRowClick={(step) => {
          const i = steps.findIndex((s) => s.stableKey === step.stableKey);
          if (i !== -1) setSelectedIndex(i);
        }}
        showEmptyState={false}
        emptyStateConfig={{
          icon: NullIcon,
          title: '',
          description: '',
          action: { label: '', onClick: () => {} },
        }}
        showAddRow={!isPending}
        onAddRow={addStep}
      />

      <StepEditorSheet
        step={selectedStep}
        open={selectedIndex !== null}
        onClose={() => setSelectedIndex(null)}
        onChange={(patch) => {
          if (selectedIndex !== null) updateStep(selectedIndex, patch);
        }}
        disabled={isPending}
      />
    </div>
  );
}

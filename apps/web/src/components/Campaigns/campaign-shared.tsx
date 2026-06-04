'use client';

import { useRef, useState } from 'react';
import {
  ErrorMessage,
  Field,
  Input,
  Label,
  Switch,
  Textarea,
  cn,
} from '@zuko/ui-kit';
import { TrashIcon } from '@heroicons/react/20/solid';
import type { ZukoCampaign, CreateSequenceStep } from '@/lib/api/apollo';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StepFormState {
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

// ─── Constants ────────────────────────────────────────────────────────────────

export const VARIABLES = [
  '{{first_name}}',
  '{{last_name}}',
  '{{company}}',
  '{{title}}',
  '{{email}}',
  '{{city}}',
  '{{country}}',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatRate(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? '—' : `${(num * 100).toFixed(1)}%`;
}

export function defaultStep(): StepFormState {
  return {
    stableKey: Math.random().toString(36).slice(2),
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

export function campaignToSteps(campaign: ZukoCampaign): StepFormState[] {
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

export function stepsToPayload(steps: StepFormState[]): CreateSequenceStep[] {
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

export function VariableChips({
  onInsert,
}: {
  onInsert: (variable: string) => void;
}) {
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

export interface StepCardProps {
  index: number;
  step: StepFormState;
  errors?: Record<string, string>;
  canRemove: boolean;
  onChange: (updated: StepFormState) => void;
  onRemove: () => void;
  disabled: boolean;
}

export function StepCard({
  index,
  step,
  errors,
  canRemove,
  onChange,
  onRemove,
  disabled,
}: StepCardProps) {
  const parser = new DOMParser();
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

  const subjectError = errors?.[`step_${index}_subject`];
  const bodyError = errors?.[`step_${index}_bodyHtml`];

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
            data-invalid={subjectError ? true : undefined}
          />
          {subjectError && <ErrorMessage>{subjectError}</ErrorMessage>}
          <VariableChips onInsert={insertVariable} />
        </Field>

        {/* Body */}
        <Field>
          <Label>Body</Label>
          <Textarea
            ref={bodyRef}
            value={
              parser.parseFromString(step.bodyHtml, 'text/html').body
                .textContent || ''
            }
            disabled={disabled}
            onFocus={() => setLastFocused('body')}
            onChange={(e) => update({ bodyHtml: e.target.value })}
            placeholder="Write your email body here…"
            rows={8}
            className="[&_textarea]:resize-none mt-3"
            data-invalid={bodyError ? true : undefined}
          />
          {bodyError && <ErrorMessage>{bodyError}</ErrorMessage>}
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

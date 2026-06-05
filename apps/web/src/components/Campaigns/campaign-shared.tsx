'use client';

import { useRef, useState } from 'react';
import { Switch, cn } from '@zuko/ui-kit';
import type { OutputData } from '@editorjs/editorjs';
import type EditorJS from '@editorjs/editorjs';
import Editor, { ensureOutputData } from '@/components/Common/Editor/Editor';
import {
  TrashIcon,
  ArrowPathIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PlusIcon,
  AdjustmentsHorizontalIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
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
  touchType: 'new_thread' | 'reply_to_thread';
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
    touchType: 'new_thread',
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
      touchType: 'new_thread',
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
        type: step.touchType,
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

// ─── EditorJS ↔ string serialisation ─────────────────────────────────────────

// EditorJS list v2 stores items as { content: string; items: [] },
// while v1 stored plain strings. Handle both.
function extractListItemText(
  item: string | { content?: string; text?: string },
): string {
  if (typeof item === 'string') return item;
  return item?.content ?? item?.text ?? '';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

function outputDataToText(data: OutputData): string {
  return data.blocks
    .map((block) => {
      switch (block.type) {
        case 'paragraph':
          return stripHtml((block.data.text as string) ?? '');
        case 'header':
          return stripHtml((block.data.text as string) ?? '');
        case 'list': {
          const items =
            (block.data.items as Array<
              string | { content?: string; text?: string }
            >) ?? [];
          return items.map(extractListItemText).filter(Boolean).join('\n');
        }
        case 'checklist': {
          const items =
            (block.data.items as Array<{ text?: string; checked?: boolean }>) ??
            [];
          return items
            .map((i) => i?.text ?? '')
            .filter(Boolean)
            .join('\n');
        }
        case 'quote':
          return stripHtml((block.data.text as string) ?? '');
        case 'code':
          return (block.data.code as string) ?? '';
        case 'delimiter':
          return '---';
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('\n');
}

// ─── Preview helpers ──────────────────────────────────────────────────────────

function substitutePreview(text: string): string {
  return text
    .replace(/\{\{first_name\}\}/g, 'Example')
    .replace(/\{\{last_name\}\}/g, 'Contact')
    .replace(/\{\{company\}\}/g, 'Acme Corp')
    .replace(/\{\{title\}\}/g, 'Manager')
    .replace(/\{\{email\}\}/g, 'example@google.com')
    .replace(/\{\{city\}\}/g, 'New York')
    .replace(/\{\{country\}\}/g, 'US');
}

// ─── Preview body renderer ───────────────────────────────────────────────────

function blockText(data: Record<string, unknown>): string {
  const t = data?.text;
  return typeof t === 'string' ? t : '';
}

function listItemText(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>;
    if (typeof o.content === 'string') return o.content;
    if (typeof o.text === 'string') return o.text;
  }
  return '';
}

function PreviewBody({ data }: { data: OutputData | null }) {
  if (!data || !data.blocks?.length) {
    return <span className="italic text-zinc-600">No body content</span>;
  }
  return (
    <div className="space-y-1">
      {data.blocks.map((block, i) => {
        const bKey = block.id ?? String(i);
        const d = (block.data ?? {}) as Record<string, unknown>;
        switch (block.type) {
          case 'paragraph':
            return (
              <p
                key={bKey}
                dangerouslySetInnerHTML={{
                  __html: substitutePreview(blockText(d)),
                }}
              />
            );
          case 'header':
            return (
              <p key={bKey} className="font-semibold">
                {substitutePreview(blockText(d))}
              </p>
            );
          case 'list': {
            const items = Array.isArray(d.items) ? d.items : [];
            const Tag = d.style === 'ordered' ? 'ol' : 'ul';
            const liClass =
              d.style === 'ordered' ? 'list-decimal' : 'list-disc';
            return (
              <Tag key={bKey} className={`list-inside pl-4 ${liClass}`}>
                {items.map((item) => {
                  const text = listItemText(item);
                  return (
                    <li key={`${bKey}-${text}`}>{substitutePreview(text)}</li>
                  );
                })}
              </Tag>
            );
          }
          case 'checklist': {
            const items = Array.isArray(d.items) ? d.items : [];
            return (
              <ul key={bKey} className="space-y-0.5 pl-1">
                {items.map((item) => {
                  const it = (item ?? {}) as Record<string, unknown>;
                  const itText = typeof it.text === 'string' ? it.text : '';
                  return (
                    <li
                      key={`${bKey}-${itText}`}
                      className="flex items-center gap-2"
                    >
                      <span className="text-zinc-500">
                        {it.checked ? '☑' : '☐'}
                      </span>
                      {substitutePreview(itText)}
                    </li>
                  );
                })}
              </ul>
            );
          }
          case 'quote':
            return (
              <blockquote
                key={bKey}
                className="border-l-2 border-zinc-500 pl-3 italic text-zinc-400"
              >
                {substitutePreview(blockText(d))}
              </blockquote>
            );
          case 'code':
            return (
              <pre
                key={bKey}
                className="rounded bg-zinc-700 p-2 font-mono text-[11px]"
              >
                {typeof d.code === 'string' ? d.code : ''}
              </pre>
            );
          case 'delimiter':
            return <hr key={bKey} className="border-zinc-600" />;
          default:
            return null;
        }
      })}
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
  const update = (patch: Partial<StepFormState>) =>
    onChange({ ...step, ...patch });

  const subjectRef = useRef<HTMLInputElement>(null);
  const ejInstanceRef = useRef<EditorJS | null>(null);
  const editorHolderId = `editor-body-${step.stableKey}`;

  const [collapsed, setCollapsed] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>(
    'desktop',
  );
  const [previewData, setPreviewData] = useState<OutputData | null>(null);

  // Keep a mutable ref to the latest handler so EditorJS's stale closure
  // (captured once at init) always calls through to the current version.
  const onEditorChangeRef = useRef<(data: OutputData) => void>(() => {});
  onEditorChangeRef.current = (data: OutputData) => {
    setPreviewData(data);
    update({ bodyHtml: outputDataToText(data) });
  };

  const subjectError = errors?.[`step_${index}_subject`];
  const bodyError = errors?.[`step_${index}_bodyHtml`];

  const stepTypeLabel =
    step.type === 'auto_email' ? 'Automatic email' : 'Manual email';
  const isReply = step.touchType === 'reply_to_thread';

  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-900 overflow-hidden">
      {/* ── Step header ── */}
      <div className="flex items-center gap-3 border-b border-zinc-700/60 px-4 py-2.5">
        {/* Enable toggle */}
        <Switch
          checked={step.status === 'approved'}
          onChange={(val) =>
            update({ status: val ? 'approved' : 'to_be_reviewed' })
          }
          disabled={disabled}
          color="dark/zinc"
        />

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 min-w-0">
          <EnvelopeIcon className="size-4 shrink-0 text-zinc-500" />
          <span className="text-sm text-zinc-400 truncate">
            Step {index + 1}: {stepTypeLabel}
          </span>
          <span className="text-zinc-600">/</span>
          <span className="text-sm font-medium text-zinc-200">Test A</span>
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-3">
          {/* Wait time */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="shrink-0">Send in</span>
            <input
              type="number"
              min={0}
              value={step.waitTime}
              disabled={disabled}
              onChange={(e) =>
                update({ waitTime: Math.max(0, Number(e.target.value)) })
              }
              className="w-12 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-center text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
            />
            <select
              value={step.waitMode}
              disabled={disabled}
              onChange={(e) =>
                update({
                  waitMode: e.target.value as 'day' | 'hour' | 'minute',
                })
              }
              className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none cursor-pointer disabled:opacity-50"
            >
              <option value="minute" className="bg-zinc-900">
                min(s)
              </option>
              <option value="hour" className="bg-zinc-900">
                hour(s)
              </option>
              <option value="day" className="bg-zinc-900">
                day(s)
              </option>
            </select>
          </div>

          {canRemove && (
            <button
              type="button"
              disabled={disabled}
              onClick={onRemove}
              className="rounded p-1 text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-40"
              title="Remove step"
            >
              <TrashIcon className="size-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {collapsed ? (
              <ChevronDownIcon className="size-4" />
            ) : (
              <ChevronUpIcon className="size-4" />
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* ── Variant tabs ── */}
          <div className="flex items-center gap-0 border-b border-zinc-700/60 px-4">
            <button
              type="button"
              className="flex items-center gap-2 border-b-2 border-blue-500 pb-2 pt-2.5 text-sm font-medium text-zinc-200"
            >
              Test A
              <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                Active
              </span>
            </button>
            <button
              type="button"
              className="ml-3 flex items-center gap-1 pb-2 pt-2.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <PlusIcon className="size-3" />
              Add test
            </button>
          </div>

          {/* ── Body ── */}
          <div className="flex min-h-0 divide-x divide-zinc-700/60">
            {/* ── Left: editor ── */}
            <div className="flex min-w-0 flex-1 flex-col">
              {/* Subject + Type row */}
              <div className="flex items-stretch divide-x divide-zinc-700/60 border-b border-zinc-700/60">
                {!isReply && (
                  <div className="flex flex-1 flex-col gap-0 px-4 py-3">
                    <label
                      htmlFor={`subject-${step.stableKey}`}
                      className="mb-1 text-xs text-zinc-500"
                    >
                      Subject
                    </label>
                    <input
                      id={`subject-${step.stableKey}`}
                      ref={subjectRef}
                      type="text"
                      value={step.subject}
                      disabled={disabled}
                      onChange={(e) => update({ subject: e.target.value })}
                      placeholder="e.g. Hello {{first_name}},"
                      className={cn(
                        'w-full bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none',
                        subjectError && 'text-red-400',
                      )}
                    />
                    {subjectError && (
                      <p className="mt-0.5 text-xs text-red-500">
                        {subjectError}
                      </p>
                    )}
                  </div>
                )}
                <div className="flex flex-col gap-0 px-4 py-3 w-40 shrink-0">
                  <label
                    htmlFor={`type-${step.stableKey}`}
                    className="mb-1 text-xs text-zinc-500"
                  >
                    Type
                  </label>
                  <select
                    id={`type-${step.stableKey}`}
                    value={step.touchType}
                    disabled={disabled}
                    onChange={(e) =>
                      update({
                        touchType: e.target.value as
                          | 'new_thread'
                          | 'reply_to_thread',
                      })
                    }
                    className="w-full bg-transparent text-sm text-zinc-200 focus:outline-none cursor-pointer"
                  >
                    <option value="new_thread" className="bg-zinc-900">
                      New thread
                    </option>
                    <option value="reply_to_thread" className="bg-zinc-900">
                      Reply to thread
                    </option>
                  </select>
                </div>
              </div>

              {/* EditorJS body */}
              <div
                className={cn(
                  'flex-1 px-2 py-2 min-h-48 text-zinc-200',
                  disabled && 'pointer-events-none opacity-60',
                  bodyError && 'ring-1 ring-red-500/50',
                )}
              >
                <Editor
                  holder={editorHolderId}
                  data={ensureOutputData(step.bodyHtml)}
                  onChange={(data) => onEditorChangeRef.current(data)}
                  onReady={(instance) => {
                    ejInstanceRef.current = instance;
                    // Seed the preview with the initial content — EditorJS
                    // doesn't fire onChange on load.
                    instance
                      .save()
                      .then((data) => onEditorChangeRef.current(data))
                      .catch(() => null);
                  }}
                  readOnly={disabled}
                  placeholder="Write your email body here…"
                />
              </div>
              {bodyError && (
                <p className="px-4 pb-2 text-xs text-red-500">{bodyError}</p>
              )}

              {/* Footer */}
              <div className="flex items-center border-t border-zinc-700/60 px-4 py-2.5">
                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    checked={step.includeSignature}
                    disabled={disabled}
                    onChange={(e) =>
                      update({ includeSignature: e.target.checked })
                    }
                    className="size-3.5 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-xs text-zinc-400">
                    Include signature
                  </span>
                </label>
              </div>
            </div>

            {/* ── Right: preview ── */}
            <div className="flex w-80 shrink-0 flex-col xl:w-96">
              <div className="border-b border-zinc-700/60 px-4 py-3">
                <p className="text-sm font-medium text-zinc-200">
                  Generate preview for contact
                </p>
              </div>

              {/* Contact selector row */}
              <div className="flex items-center gap-2 border-b border-zinc-700/60 px-3 py-2.5">
                <div className="relative flex-1">
                  <select className="w-full appearance-none rounded-md border border-zinc-700 bg-zinc-800 py-1.5 pl-3 pr-7 text-xs text-zinc-400 focus:border-zinc-500 focus:outline-none cursor-pointer">
                    <option value="">Choose a contact</option>
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-zinc-500" />
                </div>
                <button
                  type="button"
                  className="rounded p-1.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
                  title="Filter"
                >
                  <AdjustmentsHorizontalIcon className="size-4" />
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1.5 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                  title="Refresh preview"
                >
                  <ArrowPathIcon className="size-3.5" />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('desktop')}
                  className={cn(
                    'rounded p-1.5 transition-colors',
                    previewMode === 'desktop'
                      ? 'text-zinc-200'
                      : 'text-zinc-600 hover:text-zinc-400',
                  )}
                  title="Desktop preview"
                >
                  <ComputerDesktopIcon className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('mobile')}
                  className={cn(
                    'rounded p-1.5 transition-colors',
                    previewMode === 'mobile'
                      ? 'text-zinc-200'
                      : 'text-zinc-600 hover:text-zinc-400',
                  )}
                  title="Mobile preview"
                >
                  <DevicePhoneMobileIcon className="size-4" />
                </button>
              </div>

              {/* Email preview */}
              <div className="flex-1 overflow-auto p-4">
                <div
                  className={cn(
                    'mx-auto rounded-lg border border-zinc-700/60 bg-zinc-800/40 text-sm',
                    previewMode === 'mobile' ? 'max-w-xs' : 'w-full',
                  )}
                >
                  {/* Email meta */}
                  <div className="space-y-1 border-b border-zinc-700/60 px-4 py-3 text-xs text-zinc-400">
                    <p>
                      <span className="font-semibold text-zinc-300">To:</span>{' '}
                      Example Contact &lt;example@google.com&gt;
                    </p>
                    <p>
                      <span className="font-semibold text-zinc-300">
                        Subject:
                      </span>{' '}
                      {step.subject ? (
                        substitutePreview(step.subject)
                      ) : (
                        <span className="italic text-zinc-600">No subject</span>
                      )}
                    </p>
                  </div>
                  {/* Email body */}
                  <div className="px-4 py-3 text-xs leading-relaxed text-zinc-300">
                    <PreviewBody data={previewData} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

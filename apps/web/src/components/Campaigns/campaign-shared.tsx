'use client';

import type { OutputData } from '@editorjs/editorjs';
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
      touchType:
        (touch?.type as 'new_thread' | 'reply_to_thread') ?? 'new_thread',
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

// ─── EditorJS → HTML serialisation ───────────────────────────────────────────

function listItemText(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>;
    if (typeof o.content === 'string') return o.content;
    if (typeof o.text === 'string') return o.text;
  }
  return '';
}

export function outputDataToHtml(data: OutputData): string {
  return data.blocks
    .map((block) => {
      const d = (block.data ?? {}) as Record<string, unknown>;
      switch (block.type) {
        case 'paragraph':
          return `<p>${(d.text as string) ?? ''}</p>`;
        case 'header': {
          const level = (d.level as number) ?? 2;
          return `<h${level}>${(d.text as string) ?? ''}</h${level}>`;
        }
        case 'list': {
          const items = Array.isArray(d.items) ? d.items : [];
          const tag = d.style === 'ordered' ? 'ol' : 'ul';
          const liHtml = items
            .map((item) => `<li>${listItemText(item)}</li>`)
            .join('');
          return `<${tag}>${liHtml}</${tag}>`;
        }
        case 'checklist': {
          const items = Array.isArray(d.items) ? d.items : [];
          return `<ul>${items
            .map((item) => {
              const it = (item ?? {}) as Record<string, unknown>;
              return `<li>${typeof it.text === 'string' ? it.text : ''}</li>`;
            })
            .join('')}</ul>`;
        }
        case 'quote':
          return `<blockquote>${(d.text as string) ?? ''}</blockquote>`;
        case 'code':
          return `<pre><code>${(d.code as string) ?? ''}</code></pre>`;
        case 'delimiter':
          return '<hr>';
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('\n');
}

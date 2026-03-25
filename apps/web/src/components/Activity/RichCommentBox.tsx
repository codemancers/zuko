'use client';

import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';
import { Avatar, Button } from '@zuko/ui-kit';
import {
  Heading2,
  Bold,
  Italic,
  Quote,
  Code,
  Link2,
  ListOrdered,
  List,
  ListChecks,
  FileCode2,
  Image,
} from 'lucide-react';

export interface RichCommentBoxProps {
  onSubmit: (content: string) => void;
  isSubmitting: boolean;
  placeholder?: string;
  initialContent?: string;
  submitLabel?: string;
  onCancel?: () => void;
  onReady?: (api: { clear: () => void }) => void;
  avatarSrc?: string | null;
  avatarInitials?: string;
  title?: string;
}

function ToolbarBtn({
  icon,
  label,
  onAction,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        onAction?.();
      }}
      className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
    >
      <span className="h-4 w-4 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700" />;
}

type ActiveTab = 'write' | 'preview';

// Returns helpers that modify React state directly (avoids execCommand issues with controlled textarea)
function makeInsertHelpers(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  setText: (updater: (prev: string) => string) => void,
) {
  // Schedule cursor placement after React re-renders
  const setCursor = (start: number, end: number) => {
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(start, end);
      textareaRef.current?.focus();
    });
  };

  const wrapSelection = (before: string, after: string, placeholder: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value } = ta;
    const hasSelection = start !== end;
    const selected = hasSelection ? value.slice(start, end) : placeholder;
    const newText = value.slice(0, start) + before + selected + after + value.slice(end);
    setText(() => newText);
    if (hasSelection) {
      setCursor(start + before.length + selected.length + after.length, start + before.length + selected.length + after.length);
    } else {
      setCursor(start + before.length, start + before.length + placeholder.length);
    }
  };

  const insertLinePrefix = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, value } = ta;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const newText = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    setText(() => newText);
    setCursor(lineStart + prefix.length, lineStart + prefix.length);
  };

  return { wrapSelection, insertLinePrefix };
}

export function RichCommentBox({
  onSubmit,
  isSubmitting,
  placeholder = 'Add your comment here...',
  initialContent = '',
  submitLabel = 'Comment',
  onCancel,
  onReady,
  avatarSrc,
  avatarInitials,
  title,
}: RichCommentBoxProps) {
  // Normalise legacy Editor.js JSON to plain text on mount
  const [text, setText] = useState<string>(() => {
    if (!initialContent) return '';
    try {
      const parsed = JSON.parse(initialContent);
      if (Array.isArray(parsed?.blocks)) {
        return parsed.blocks
          .map((b: { type: string; data: Record<string, unknown> }) => {
            if (b.type === 'paragraph' || b.type === 'header') return String(b.data.text ?? '');
            if (b.type === 'code') return `\`\`\`\n${b.data.code}\n\`\`\``;
            if (b.type === 'quote') return `> ${b.data.text}`;
            if (b.type === 'list') {
              const items = Array.isArray(b.data.items) ? b.data.items : [];
              return items
                .map((item: unknown, i: number) =>
                  b.data.style === 'ordered' ? `${i + 1}. ${item}` : `- ${item}`,
                )
                .join('\n');
            }
            return '';
          })
          .filter(Boolean)
          .join('\n\n');
      }
    } catch { /* not JSON */ }
    return initialContent;
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('write');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const { wrapSelection, insertLinePrefix } = makeInsertHelpers(textareaRef, setText);

  // Expose clear() to parent
  const clearRef = useCallback(() => {
    setText('');
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    onReady?.({ clear: clearRef });
    // onReady is intentionally run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = async (tab: ActiveTab) => {
    if (tab === 'preview') {
      const trimmed = text.trim();
      if (trimmed) {
        const { marked } = await import('marked');
        setPreviewHtml(await marked(trimmed));
      } else {
        setPreviewHtml(null);
      }
    }
    setActiveTab(tab);
  };

  const handleSubmit = () => {
    if (isSubmitting || !text.trim()) return;
    onSubmit(text);
  };

  const showAvatar = avatarSrc !== undefined || avatarInitials !== undefined;

  return (
    <div className="flex gap-3">
      {/* Avatar column */}
      {showAvatar && (
        <div className="flex-shrink-0 pt-0.5">
          <Avatar src={avatarSrc} initials={avatarInitials} className="size-8" alt="" />
        </div>
      )}

      {/* Right column */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        {title && (
          <p className="mb-2 text-sm font-semibold text-zinc-950 dark:text-white">
            {title}
          </p>
        )}

        {/* Editor box */}
        <div className="overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-colors">

          {/* ── Tab bar + toolbar ─────────────────────────────────── */}
          <div className="flex items-center border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 pl-1 pr-2">

            {/* Tabs */}
            <div className="flex shrink-0">
              {(['write', 'preview'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={[
                    'px-3 py-2 text-sm font-medium capitalize transition-colors',
                    activeTab === tab
                      ? 'border-b-2 border-zinc-950 dark:border-white text-zinc-950 dark:text-white -mb-px'
                      : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200',
                  ].join(' ')}
                >
                  {tab}
                </button>
              ))}
            </div>

            <ToolbarDivider />

            {/* Inline format tools */}
            <div className="flex items-center">
              <ToolbarBtn icon={<Heading2 />} label="Heading" onAction={() => insertLinePrefix('## ')} />
              <ToolbarBtn icon={<Bold />} label="Bold (Ctrl+B)" onAction={() => wrapSelection('**', '**', 'bold text')} />
              <ToolbarBtn icon={<Italic />} label="Italic (Ctrl+I)" onAction={() => wrapSelection('_', '_', 'italic text')} />
              <ToolbarBtn icon={<Quote />} label="Quote" onAction={() => insertLinePrefix('> ')} />
              <ToolbarBtn icon={<Code />} label="Code block" onAction={() => wrapSelection('```\n', '\n```', 'code')} />
              <ToolbarBtn icon={<Link2 />} label="Link" onAction={() => wrapSelection('[', '](url)', 'link text')} />
            </div>

            <ToolbarDivider />

            {/* Block format tools */}
            <div className="flex items-center">
              <ToolbarBtn icon={<ListOrdered />} label="Ordered list" onAction={() => insertLinePrefix('1. ')} />
              <ToolbarBtn icon={<List />} label="Unordered list" onAction={() => insertLinePrefix('- ')} />
              <ToolbarBtn icon={<ListChecks />} label="Task list" onAction={() => insertLinePrefix('- [ ] ')} />
            </div>

          </div>

          {/* ── Write area ────────────────────────────────────────── */}
          {activeTab === 'write' && (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              rows={6}
              className="w-full resize-none bg-white dark:bg-zinc-950 px-3 py-3 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none font-mono leading-relaxed"
            />
          )}

          {/* ── Preview area ──────────────────────────────────────── */}
          {activeTab === 'preview' && (
            <div className="min-h-[150px] px-3 py-3">
              {previewHtml ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none
                    prose-p:text-zinc-700 dark:prose-p:text-zinc-300
                    prose-headings:text-zinc-950 dark:prose-headings:text-white
                    prose-code:text-zinc-800 dark:prose-code:text-zinc-200
                    prose-pre:bg-zinc-100 dark:prose-pre:bg-zinc-800
                    prose-blockquote:border-zinc-300 dark:prose-blockquote:border-zinc-600"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">
                  Nothing to preview
                </p>
              )}
            </div>
          )}

          {/* ── Footer ────────────────────────────────────────────── */}
          <div className="flex items-center gap-5 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40 px-3 py-1.5">
            <span className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
              <FileCode2 className="h-3.5 w-3.5 shrink-0" />
              Markdown is supported
            </span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
              <Image className="h-3.5 w-3.5 shrink-0" />
              Paste, drop, or click to add files
            </span>
          </div>
        </div>

        {/* ── Action row ────────────────────────────────────────────── */}
        <div className="mt-3 flex items-center justify-end gap-2">
          {onCancel && (
            <Button type="button" plain onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

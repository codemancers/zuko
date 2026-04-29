'use client';

import { useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Avatar, Button, Subheading } from '@zuko/ui-kit';
import {
  CodeBracketIcon as Code,
  LinkIcon as Link2,
  NumberedListIcon as ListOrdered,
  Bars3BottomLeftIcon as List,
  ClipboardDocumentCheckIcon as ListChecks,
  CodeBracketSquareIcon as FileCode2,
} from '@heroicons/react/24/outline';

import { MarkdownContent } from './MarkdownContent';
import { editorJsonToMarkdown } from '@/lib/editor-utils';

const Heading2 = (props: React.ComponentProps<'svg'>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 12h8" />
    <path d="M4 18V6" />
    <path d="M12 18V6" />
    <path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.25-4-1.25" />
  </svg>
);
const Bold = (props: React.ComponentProps<'svg'>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M14 12a4 4 0 0 0 0-8H6v8" />
    <path d="M15 20a4 4 0 0 0 0-8H6v8Z" />
  </svg>
);
const Italic = (props: React.ComponentProps<'svg'>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="19" x2="10" y1="4" y2="4" />
    <line x1="14" x2="5" y1="20" y2="20" />
    <line x1="15" x2="9" y1="4" y2="20" />
  </svg>
);
const Quote = (props: React.ComponentProps<'svg'>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
    <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
  </svg>
);

export interface CommentBoxProps {
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

function getInitialText(raw: string | undefined): string {
  if (!raw) return '';
  return editorJsonToMarkdown(raw) ?? raw;
}

function makeInsertHelpers(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  setText: React.Dispatch<React.SetStateAction<string>>,
) {
  const wrap = (before: string, after: string, placeholder: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.slice(start, end) || placeholder;
    const newValue =
      el.value.slice(0, start) +
      before +
      selected +
      after +
      el.value.slice(end);
    setText(newValue);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
      );
    });
  };

  const linePrefix = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = el.value.lastIndexOf('\n', start - 1) + 1;
    const newValue =
      el.value.slice(0, lineStart) + prefix + el.value.slice(lineStart);
    setText(newValue);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  };

  const insertBlock = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const before = el.value.slice(0, start);
    const after = el.value.slice(start);
    const prefix =
      before.length && !before.endsWith('\n\n')
        ? before.endsWith('\n')
          ? '\n'
          : '\n\n'
        : '';
    const newValue = before + prefix + snippet + '\n\n' + after;
    setText(newValue);
    const pos = before.length + prefix.length + snippet.length + 2;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  return { wrap, linePrefix, insertBlock };
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
  return (
    <span className="mx-0.5 h-4 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700" />
  );
}

type ActiveTab = 'write' | 'preview';

export function CommentBox({
  onSubmit,
  isSubmitting,
  placeholder = 'Add a comment...',
  initialContent,
  submitLabel = 'Post Comment',
  onCancel,
  onReady,
  avatarSrc,
  avatarInitials,
  title,
}: CommentBoxProps) {
  const [text, setText] = useState(() => getInitialText(initialContent));
  const [activeTab, setActiveTab] = useState<ActiveTab>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const readyRef = useRef(false);
  if (!readyRef.current) {
    readyRef.current = true;
    onReady?.({ clear: () => setText('') });
  }

  const { wrap, linePrefix, insertBlock } = makeInsertHelpers(
    textareaRef,
    setText,
  );

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
          <Avatar
            src={avatarSrc}
            initials={avatarInitials}
            className="size-8"
            alt=""
          />
        </div>
      )}

      {/* Right column */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        {title && <Subheading className="mb-6">{title}</Subheading>}

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
                  onClick={() => setActiveTab(tab)}
                  className={clsx(
                    'px-3 py-2 text-sm font-medium capitalize transition-colors',
                    activeTab === tab
                      ? 'border-b-2 border-zinc-950 dark:border-white text-zinc-950 dark:text-white -mb-px'
                      : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200',
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            <ToolbarDivider />

            {/* Inline format tools — only active on Write tab */}
            <div className="flex items-center">
              <ToolbarBtn
                icon={<Heading2 />}
                label="Heading"
                disabled={activeTab !== 'write'}
                onAction={() => linePrefix('## ')}
              />
              <ToolbarBtn
                icon={<Bold />}
                label="Bold (Ctrl+B)"
                disabled={activeTab !== 'write'}
                onAction={() => wrap('**', '**', 'bold text')}
              />
              <ToolbarBtn
                icon={<Italic />}
                label="Italic (Ctrl+I)"
                disabled={activeTab !== 'write'}
                onAction={() => wrap('_', '_', 'italic text')}
              />
              <ToolbarBtn
                icon={<Quote />}
                label="Quote"
                disabled={activeTab !== 'write'}
                onAction={() => linePrefix('> ')}
              />
              <ToolbarBtn
                icon={<Code />}
                label="Code block"
                disabled={activeTab !== 'write'}
                onAction={() => insertBlock('```\n\n```')}
              />
              <ToolbarBtn
                icon={<Link2 />}
                label="Link"
                disabled={activeTab !== 'write'}
                onAction={() => wrap('[', '](url)', 'link text')}
              />
            </div>

            <ToolbarDivider />

            {/* Block format tools */}
            <div className="flex items-center">
              <ToolbarBtn
                icon={<ListOrdered />}
                label="Ordered list"
                disabled={activeTab !== 'write'}
                onAction={() => linePrefix('1. ')}
              />
              <ToolbarBtn
                icon={<List />}
                label="Unordered list"
                disabled={activeTab !== 'write'}
                onAction={() => linePrefix('- ')}
              />
              <ToolbarBtn
                icon={<ListChecks />}
                label="Task list"
                disabled={activeTab !== 'write'}
                onAction={() => linePrefix('- [ ] ')}
              />
            </div>
          </div>

          {/* ── Write area ────────────────────────────────────────── */}
          {activeTab === 'write' && (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              rows={5}
              className="w-full resize-none bg-white dark:bg-zinc-950 px-3 py-3 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none font-mono"
            />
          )}

          {/* ── Preview area ──────────────────────────────────────── */}
          {activeTab === 'preview' && (
            <div className="min-h-[150px] px-3 py-3">
              {text.trim() ? (
                <MarkdownContent content={text} />
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
          </div>
        </div>

        {/* ── Action row ────────────────────────────────────────────── */}
        <div className="mt-3 flex items-center justify-end gap-2">
          {onCancel && (
            <Button
              type="button"
              plain
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !text.trim()}
          >
            {isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type EditorJS from '@editorjs/editorjs';
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
  Paperclip,
  AtSign,
  Undo2,
  Maximize2,
  FileCode2,
  Image,
} from 'lucide-react';
import { RichContent } from './RichContent';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseInitialData(raw: string | undefined): any {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.blocks)) return parsed;
  } catch { /* fall through */ }
  if (raw.trim()) {
    return {
      time: Date.now(),
      blocks: [{ type: 'paragraph', data: { text: raw.trim() } }],
      version: '2.30.7',
    };
  }
  return undefined;
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
      // onMouseDown + preventDefault keeps focus inside the contenteditable so
      // inline commands (bold, italic) act on the current selection, and block
      // insertions still have an active editor context.
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

export function RichCommentBox({
  onSubmit,
  isSubmitting,
  placeholder = 'Add your comment here...',
  initialContent,
  submitLabel = 'Comment',
  onCancel,
  onReady,
  avatarSrc,
  avatarInitials,
  title,
}: RichCommentBoxProps) {
  const editorRef = useRef<EditorJS | null>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('write');
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  useEffect(() => {
    if (!holderRef.current || isInitialized.current) return;
    isInitialized.current = true;

    // cancelled flag prevents a second EditorJS instance being created if React
    // StrictMode fires the cleanup before the async Promise.all resolves
    let cancelled = false;
    let instance: EditorJS | null = null;

    const init = async () => {
      const [
        { default: EditorJSClass },
        { default: Header },
        { default: List },
        { default: Quote },
        { default: Code },
        { default: InlineCode },
        { default: Marker },
      ] = await Promise.all([
        import('@editorjs/editorjs'),
        import('@editorjs/header'),
        import('@editorjs/list'),
        import('@editorjs/quote'),
        import('@editorjs/code'),
        import('@editorjs/inline-code'),
        import('@editorjs/marker'),
      ]);

      if (cancelled || !holderRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: any = {
        holder: holderRef.current,
        placeholder,
        data: parseInitialData(initialContent),
        logLevel: 'ERROR',
        tools: {
          header: { class: Header, config: { levels: [2, 3], defaultLevel: 2 } },
          list: { class: List, inlineToolbar: true },
          quote: { class: Quote, inlineToolbar: true },
          code: Code,
          inlineCode: { class: InlineCode, shortcut: 'CMD+SHIFT+M' },
          marker: { class: Marker, shortcut: 'CMD+SHIFT+H' },
        },
      };

      instance = new EditorJSClass(config);
      editorRef.current = instance;
      onReady?.({ clear: () => instance?.clear() });
    };

    init();

    return () => {
      cancelled = true;
      instance?.destroy();
      editorRef.current = null;
      isInitialized.current = false;
    };
    // placeholder and initialContent intentionally omitted — editor is initialized once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (!editorRef.current || isSubmitting) return;
    const data = await editorRef.current.save();
    if (!data.blocks.length) return;
    onSubmit(JSON.stringify(data));
  };

  const handleTabChange = async (tab: ActiveTab) => {
    if (tab === 'preview' && editorRef.current) {
      const data = await editorRef.current.save();
      setPreviewContent(data.blocks.length ? JSON.stringify(data) : null);
    }
    setActiveTab(tab);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertBlock = (type: string, data?: Record<string, any>) => {
    if (!editorRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editorRef.current as any).blocks.insert(type, data ?? {});
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
              <ToolbarBtn icon={<Heading2 />} label="Heading" onAction={() => insertBlock('header', { text: '', level: 2 })} />
              <ToolbarBtn icon={<Bold />} label="Bold (Ctrl+B)" onAction={() => document.execCommand('bold', false)} />
              <ToolbarBtn icon={<Italic />} label="Italic (Ctrl+I)" onAction={() => document.execCommand('italic', false)} />
              <ToolbarBtn icon={<Quote />} label="Quote" onAction={() => insertBlock('quote', { text: '' })} />
              <ToolbarBtn icon={<Code />} label="Code block" onAction={() => insertBlock('code', { code: '' })} />
              <ToolbarBtn icon={<Link2 />} label="Link" />
            </div>

            <ToolbarDivider />

            {/* Block format tools */}
            <div className="flex items-center">
              <ToolbarBtn icon={<ListOrdered />} label="Ordered list" onAction={() => insertBlock('list', { style: 'ordered', items: [''] })} />
              <ToolbarBtn icon={<List />} label="Unordered list" onAction={() => insertBlock('list', { style: 'unordered', items: [''] })} />
              <ToolbarBtn icon={<ListChecks />} label="Task list" />
            </div>

            <ToolbarDivider />

            {/* Utility tools */}
            <div className="flex items-center">
              <ToolbarBtn icon={<Paperclip />} label="Attach files" />
              <ToolbarBtn icon={<AtSign />} label="Mention a user" />
              <ToolbarBtn icon={<Undo2 />} label="Undo" onAction={() => document.execCommand('undo', false)} />
              <ToolbarBtn icon={<Maximize2 />} label="Expand editor" />
            </div>
          </div>

          {/* ── Write area ────────────────────────────────────────── */}
          <div className={activeTab === 'write' ? undefined : 'hidden'}>
            {/* Scoped overrides for Editor.js injected styles */}
            <style>{`
              /* Layout fixes */
              .zuko-editor .codex-editor__redactor { padding-bottom: 1rem !important; }
              .zuko-editor .codex-editor[data-placeholder]::before { display: none !important; }
              .zuko-editor .ce-toolbar { display: none !important; }
              .zuko-editor .ce-block__content { max-width: 100% !important; margin: 0 !important; }

              /* Inline toolbar — light mode */
              .zuko-editor .ce-inline-toolbar {
                background-color: #ffffff;
                border: 1px solid #e4e4e7;
                border-radius: 6px;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                color: #18181b;
              }
              .zuko-editor .ce-inline-tool,
              .zuko-editor .ce-inline-toolbar__dropdown {
                color: #52525b;
              }
              .zuko-editor .ce-inline-tool:hover {
                background-color: #f4f4f5;
                color: #18181b;
              }
              .zuko-editor .ce-inline-tool--active { color: #6366f1; }

              /* Inline toolbar — dark mode */
              .dark .zuko-editor .ce-inline-toolbar {
                background-color: #27272a;
                border-color: #3f3f46;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5);
                color: #d4d4d8;
              }
              .dark .zuko-editor .ce-inline-tool,
              .dark .zuko-editor .ce-inline-toolbar__dropdown {
                color: #a1a1aa;
              }
              .dark .zuko-editor .ce-inline-tool:hover {
                background-color: #3f3f46;
                color: #f4f4f5;
              }
              .dark .zuko-editor .ce-inline-tool--active { color: #818cf8; }

              /* Conversion toolbar (T ▾ dropdown) */
              .dark .zuko-editor .ce-conversion-toolbar {
                background-color: #27272a;
                border-color: #3f3f46;
              }
              .dark .zuko-editor .ce-conversion-tool {
                color: #a1a1aa;
              }
              .dark .zuko-editor .ce-conversion-tool:hover {
                background-color: #3f3f46;
                color: #f4f4f5;
              }
              .dark .zuko-editor .ce-conversion-tool__icon {
                background-color: #3f3f46;
              }
            `}</style>
            <div
              ref={holderRef}
              className="zuko-editor min-h-[120px] px-3 py-3 text-sm text-zinc-950 dark:text-white
                [&_.ce-block]:py-0.5
                [&_.ce-paragraph]:text-sm
                [&_.codex-editor]:outline-none
                [&_.ce-inline-toolbar]:z-50"
            />
          </div>

          {/* ── Preview area ──────────────────────────────────────── */}
          {activeTab === 'preview' && (
            <div className="min-h-[150px] px-3 py-3">
              {previewContent ? (
                <RichContent content={previewContent} />
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
            <Button plain onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          <Button color="green" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

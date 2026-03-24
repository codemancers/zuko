'use client';

import type { ReactNode } from 'react';

interface EditorBlock {
  type: string;
  data: Record<string, unknown>;
}

interface EditorData {
  blocks: EditorBlock[];
}

function parseEditorContent(content: string): EditorData | null {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed?.blocks)) return parsed as EditorData;
  } catch { /* not JSON */ }
  return null;
}

function renderBlock(block: EditorBlock, index: number): ReactNode {
  const { type, data } = block;

  switch (type) {
    case 'paragraph':
      return (
        <p
          key={index}
          className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: String(data.text ?? '') }}
        />
      );

    case 'header': {
      const level = Number(data.level ?? 2);
      const Tag = `h${level}` as 'h2' | 'h3';
      return (
        <Tag
          key={index}
          className={`${level === 2 ? 'text-base' : 'text-sm'} font-semibold text-zinc-950 dark:text-white mt-2 first:mt-0`}
          dangerouslySetInnerHTML={{ __html: String(data.text ?? '') }}
        />
      );
    }

    case 'list': {
      const items = (Array.isArray(data.items) ? data.items : []) as string[];
      const Tag = data.style === 'ordered' ? 'ol' : 'ul';
      return (
        <Tag
          key={index}
          className={`${data.style === 'ordered' ? 'list-decimal' : 'list-disc'} list-inside text-sm text-zinc-700 dark:text-zinc-300 space-y-0.5`}
        >
          {items.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </Tag>
      );
    }

    case 'quote':
      return (
        <blockquote
          key={index}
          className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-3 py-0.5 text-sm text-zinc-600 dark:text-zinc-400 italic"
        >
          <p dangerouslySetInnerHTML={{ __html: String(data.text ?? '') }} />
          {Boolean(data.caption) && (
            <cite className="mt-1 block text-xs not-italic text-zinc-500">
              — <span dangerouslySetInnerHTML={{ __html: String(data.caption) }} />
            </cite>
          )}
        </blockquote>
      );

    case 'code':
      return (
        <pre
          key={index}
          className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-xs font-mono text-zinc-800 dark:text-zinc-200 overflow-x-auto whitespace-pre-wrap"
        >
          <code>{String(data.code ?? '')}</code>
        </pre>
      );

    default:
      return null;
  }
}

export function RichContent({ content }: { content: string | null | undefined }) {
  if (!content) return null;

  const editorData = parseEditorContent(content);

  // Legacy plain-text fallback
  if (!editorData) {
    return (
      <pre className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
        {content}
      </pre>
    );
  }

  return (
    <div className="space-y-1.5">
      {editorData.blocks.map(renderBlock)}
    </div>
  );
}

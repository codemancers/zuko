'use client';

import { useEffect, useState } from 'react';

// Convert legacy Editor.js JSON to a markdown string
function editorJsonToMarkdown(content: string): string | null {
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed?.blocks)) return null;
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
  } catch {
    return null;
  }
}

export function RichContent({ content }: { content: string | null | undefined }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!content) { setHtml(null); return; }

    const markdown = editorJsonToMarkdown(content) ?? content;

    import('marked').then(({ marked }) => {
      const result = marked.parse(markdown);
      // marked.parse returns string | Promise<string>; resolve either
      Promise.resolve(result).then(setHtml);
    });
  }, [content]);

  if (!html) return null;

  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none
        prose-p:text-zinc-700 dark:prose-p:text-zinc-300 prose-p:my-1
        prose-headings:text-zinc-950 dark:prose-headings:text-white prose-headings:my-1
        prose-code:text-zinc-800 dark:prose-code:text-zinc-200
        prose-pre:bg-zinc-100 dark:prose-pre:bg-zinc-800 prose-pre:my-1.5
        prose-blockquote:border-zinc-300 dark:prose-blockquote:border-zinc-600 prose-blockquote:my-1
        prose-ul:my-1 prose-ol:my-1 prose-li:my-0"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

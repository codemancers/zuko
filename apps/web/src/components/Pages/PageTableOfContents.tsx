'use client';

import type { OutputData } from '@zuko/ui-kit';

interface Heading {
  text: string;
  level: number;
  index: number;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

export function extractHeadings(data: OutputData): Heading[] {
  return (data?.blocks ?? [])
    .map((b, index) => ({ b, index }))
    .filter(({ b }) => b.type === 'header')
    .map(({ b, index }) => ({
      text: stripHtml(String(b.data?.text ?? '')),
      level: Number(b.data?.level ?? 2),
      index,
    }))
    .filter((h) => h.text.length > 0);
}

/**
 * Jump-links built from the page's header blocks. Editor.js renders blocks
 * in order inside the holder, so the Nth heading in our extracted list maps
 * to the Nth h1–h6 element under [data-testid="wiki-editor"].
 */
export function PageTableOfContents({ data }: { data: OutputData }) {
  const headings = extractHeadings(data);

  const scrollTo = (index: number) => {
    const holder = document.querySelector('[data-testid="wiki-editor"]');
    if (!holder) return;
    const els = holder.querySelectorAll('h1, h2, h3, h4, h5, h6');
    els[headings.findIndex((h) => h.index === index)]?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  if (headings.length === 0) {
    return (
      <p className="text-sm text-zinc-400 italic dark:text-zinc-500">
        No headings on this page
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {headings.map((h) => (
        <li key={h.index} style={{ paddingLeft: `${(h.level - 2) * 12}px` }}>
          <button
            type="button"
            onClick={() => scrollTo(h.index)}
            className="text-left text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {h.text}
          </button>
        </li>
      ))}
    </ul>
  );
}

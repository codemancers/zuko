// Markdown ↔ Editor.js bridge.
//
// The wiki stores canonical Editor.js JSON (`Page.blocks`); agents speak
// markdown over MCP. These converters are dependency-free and intentionally
// cover the common subset: headers, paragraphs, lists (nested, ordered,
// checklists), code fences, quotes, tables, delimiters, images/attachments,
// and the inline marks bold/italic/code/link.
//
// Round-trips are lossy for exotic blocks (embeds, custom tools): unknown
// block types degrade to their `text` field or are skipped. Tool descriptions
// on the MCP side document this.

export interface EditorJsBlock {
  id?: string;
  type: string;
  data: Record<string, unknown>;
}

export interface EditorJsDocument {
  time?: number;
  blocks: EditorJsBlock[];
  version?: string;
}

// ---------------------------------------------------------------------------
// Inline conversions
// ---------------------------------------------------------------------------

const decodeEntities = (s: string): string =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Editor.js inline HTML → markdown inline marks. */
export function htmlInlineToMarkdown(html: string): string {
  let out = html;
  out = out.replace(/<br\s*\/?>/gi, '\n');
  out = out.replace(/<(b|strong)>([\s\S]*?)<\/\1>/gi, '**$2**');
  out = out.replace(/<(i|em)>([\s\S]*?)<\/\1>/gi, '*$2*');
  out = out.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  out = out.replace(
    /<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    '[$2]($1)',
  );
  out = out.replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '$1');
  out = out.replace(/<[^>]+>/g, ''); // strip anything else
  return decodeEntities(out);
}

/** Markdown inline marks → Editor.js inline HTML (input is escaped first). */
export function markdownInlineToHtml(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

// ---------------------------------------------------------------------------
// Blocks → markdown
// ---------------------------------------------------------------------------

type ListItem =
  | string
  | { content?: string; items?: ListItem[]; meta?: { checked?: boolean } };

function listToMarkdown(
  items: ListItem[],
  style: string,
  depth: number,
): string[] {
  const lines: string[] = [];
  const indent = '  '.repeat(depth);
  items.forEach((item, i) => {
    const obj = typeof item === 'string' ? { content: item } : item;
    const text = htmlInlineToMarkdown(obj.content ?? '');
    let marker: string;
    if (style === 'checklist') {
      marker = obj.meta?.checked ? '- [x]' : '- [ ]';
    } else if (style === 'ordered') {
      marker = `${i + 1}.`;
    } else {
      marker = '-';
    }
    lines.push(`${indent}${marker} ${text}`);
    if (obj.items && obj.items.length > 0) {
      lines.push(...listToMarkdown(obj.items, style, depth + 1));
    }
  });
  return lines;
}

/** Convert an Editor.js document (or bare block array) to markdown. */
export function blocksToMarkdown(
  input: EditorJsDocument | EditorJsBlock[] | null | undefined,
): string {
  const blocks = Array.isArray(input) ? input : (input?.blocks ?? []);
  const parts: string[] = [];

  for (const block of blocks) {
    const data = (block.data ?? {}) as Record<string, any>;
    switch (block.type) {
      case 'header': {
        const level = Math.min(Math.max(Number(data.level) || 1, 1), 6);
        parts.push(
          `${'#'.repeat(level)} ${htmlInlineToMarkdown(data.text ?? '')}`,
        );
        break;
      }
      case 'paragraph':
        parts.push(htmlInlineToMarkdown(data.text ?? ''));
        break;
      case 'list':
      case 'checklist': {
        const style =
          block.type === 'checklist'
            ? 'checklist'
            : String(data.style ?? 'unordered');
        const items: ListItem[] =
          block.type === 'checklist'
            ? (data.items ?? []).map((it: any) => ({
                content: it.text ?? it.content,
                meta: { checked: Boolean(it.checked ?? it.meta?.checked) },
              }))
            : (data.items ?? []);
        parts.push(listToMarkdown(items, style, 0).join('\n'));
        break;
      }
      case 'code':
        parts.push('```\n' + String(data.code ?? '') + '\n```');
        break;
      case 'quote': {
        const text = htmlInlineToMarkdown(data.text ?? '');
        const quoted = text
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n');
        parts.push(
          data.caption
            ? `${quoted}\n> — ${htmlInlineToMarkdown(data.caption)}`
            : quoted,
        );
        break;
      }
      case 'delimiter':
        parts.push('---');
        break;
      case 'table': {
        const content: string[][] = data.content ?? [];
        if (content.length === 0) break;
        const rows = content.map(
          (row) =>
            `| ${row.map((c) => htmlInlineToMarkdown(c ?? '')).join(' | ')} |`,
        );
        const cols = content[0]?.length ?? 0;
        const sep = `| ${Array(cols).fill('---').join(' | ')} |`;
        // Editor.js marks the first row as headings via withHeadings; markdown
        // tables always need a separator, so emit one either way.
        rows.splice(1, 0, sep);
        parts.push(rows.join('\n'));
        break;
      }
      case 'image': {
        const url = data.file?.url ?? data.url ?? '';
        parts.push(`![${htmlInlineToMarkdown(data.caption ?? '')}](${url})`);
        break;
      }
      case 'attaches': {
        const url = data.file?.url ?? '';
        const name = data.title ?? data.file?.name ?? 'attachment';
        parts.push(`[${name}](${url})`);
        break;
      }
      case 'linkTool': {
        const url = data.link ?? '';
        parts.push(`[${data.meta?.title ?? url}](${url})`);
        break;
      }
      default: {
        // Unknown tool: degrade to its text field when present, else skip.
        if (typeof data.text === 'string' && data.text.length > 0) {
          parts.push(htmlInlineToMarkdown(data.text));
        }
        break;
      }
    }
  }

  return parts.filter((p) => p.length > 0).join('\n\n');
}

// ---------------------------------------------------------------------------
// Markdown → blocks
// ---------------------------------------------------------------------------

interface ParsedListLine {
  depth: number;
  ordered: boolean;
  checked: boolean | null;
  text: string;
}

const LIST_RE = /^(\s*)(?:([-*+])|(\d+)[.)])\s+(?:\[([ xX])\]\s+)?(.*)$/;

function parseListLine(line: string): ParsedListLine | null {
  const m = LIST_RE.exec(line);
  if (!m) return null;
  return {
    depth: Math.floor(m[1].replace(/\t/g, '  ').length / 2),
    ordered: m[3] !== undefined,
    checked: m[4] === undefined ? null : m[4].toLowerCase() === 'x',
    text: m[5] ?? '',
  };
}

interface NestedItem {
  content: string;
  meta: { checked?: boolean };
  items: NestedItem[];
}

function buildNested(lines: ParsedListLine[]): NestedItem[] {
  const root: NestedItem[] = [];
  const stack: { depth: number; items: NestedItem[] }[] = [
    { depth: -1, items: root },
  ];
  for (const line of lines) {
    const item: NestedItem = {
      content: markdownInlineToHtml(line.text),
      meta: line.checked === null ? {} : { checked: line.checked },
      items: [],
    };
    while (stack.length > 1 && line.depth <= stack[stack.length - 1].depth) {
      stack.pop();
    }
    stack[stack.length - 1].items.push(item);
    stack.push({ depth: line.depth, items: item.items });
  }
  return root;
}

/** Convert markdown to Editor.js blocks (canonical storage shape). */
export function markdownToBlocks(markdown: string): EditorJsBlock[] {
  const blocks: EditorJsBlock[] = [];
  const lines = (markdown ?? '').replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  const flushParagraph = (buf: string[]) => {
    const text = buf.join(' ').trim();
    if (text.length > 0) {
      blocks.push({
        type: 'paragraph',
        data: { text: markdownInlineToHtml(text) },
      });
    }
    buf.length = 0;
  };

  const paragraph: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    // blank line — paragraph boundary
    if (/^\s*$/.test(line)) {
      flushParagraph(paragraph);
      i++;
      continue;
    }

    // fenced code
    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      flushParagraph(paragraph);
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({ type: 'code', data: { code: code.join('\n') } });
      continue;
    }

    // header
    const header = /^(#{1,6})\s+(.*)$/.exec(line);
    if (header) {
      flushParagraph(paragraph);
      blocks.push({
        type: 'header',
        data: {
          level: header[1].length,
          text: markdownInlineToHtml(header[2]),
        },
      });
      i++;
      continue;
    }

    // delimiter
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      flushParagraph(paragraph);
      blocks.push({ type: 'delimiter', data: {} });
      i++;
      continue;
    }

    // quote (consecutive `>` lines fold into one block)
    if (/^\s*>/.test(line)) {
      flushParagraph(paragraph);
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'quote',
        data: {
          text: markdownInlineToHtml(quote.join('\n')),
          caption: '',
          alignment: 'left',
        },
      });
      continue;
    }

    // table
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushParagraph(paragraph);
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i]
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
        // skip the |---|---| separator row
        if (!cells.every((c) => /^:?-{3,}:?$/.test(c))) {
          rows.push(cells.map((c) => markdownInlineToHtml(c)));
        }
        i++;
      }
      blocks.push({
        type: 'table',
        data: { withHeadings: true, content: rows },
      });
      continue;
    }

    // standalone image
    const image = /^\s*!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(line);
    if (image) {
      flushParagraph(paragraph);
      blocks.push({
        type: 'image',
        data: {
          file: { url: image[2] },
          caption: markdownInlineToHtml(image[1]),
          withBorder: false,
          stretched: false,
          withBackground: false,
        },
      });
      i++;
      continue;
    }

    // list (unordered / ordered / checklist), nested by 2-space indent
    if (parseListLine(line)) {
      flushParagraph(paragraph);
      const parsed: ParsedListLine[] = [];
      while (i < lines.length) {
        const p = parseListLine(lines[i]);
        if (!p) break;
        parsed.push(p);
        i++;
      }
      const isChecklist = parsed.some((p) => p.checked !== null);
      const isOrdered = parsed[0].ordered;
      blocks.push({
        type: 'list',
        data: {
          style: isChecklist
            ? 'checklist'
            : isOrdered
              ? 'ordered'
              : 'unordered',
          items: buildNested(parsed),
        },
      });
      continue;
    }

    // plain text — accumulate into paragraph
    paragraph.push(line.trim());
    i++;
  }

  flushParagraph(paragraph);
  return blocks;
}

/** Wrap blocks in the canonical stored document shape. */
export function blocksToDocument(blocks: EditorJsBlock[]): EditorJsDocument {
  return { time: Date.now(), blocks, version: '2.29.0' };
}

/**
 * Convert legacy Editor.js JSON to a markdown string.
 * Returns null if the input is not valid Editor.js JSON.
 */
export function editorJsonToMarkdown(content: string): string | null {
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed?.blocks)) return null;
    return parsed.blocks
      .map((b: { type: string; data: Record<string, unknown> }) => {
        if (b.type === 'paragraph' || b.type === 'header')
          return String(b.data.text ?? '');
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

/**
 * Zuko stores rich-text fields (contact notes, company/deal summaries) as
 * Editor.js documents. Tools accept plain text and wrap it into a minimal
 * single-paragraph document.
 */
export interface EditorData {
  time?: number;
  blocks: Array<{ type: string; data: Record<string, unknown> }>;
  version?: string;
}

export function toEditorData(text: string): EditorData {
  return {
    time: Date.now(),
    blocks: text
      .split(/\n{2,}/)
      .filter((p) => p.trim().length > 0)
      .map((paragraph) => ({
        type: 'paragraph',
        data: { text: paragraph.trim() },
      })),
    version: '2.30.0',
  };
}

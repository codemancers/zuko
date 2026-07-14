import { z } from 'zod';

// Editor.js block (the shape the wiki editor saves and the MCP tools exchange).
const EditorJsBlockSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  data: z.record(z.string(), z.any()),
});

type EditorJsBlock = z.infer<typeof EditorJsBlockSchema>;

// Create a standalone page. Everything is optional — a blank, untitled,
// org-wide top-level page is valid. `parentId` nests it under another page
// (subpages). The organization comes from the request context, never the body.
export const CreatePageSchema = z.object({
  title: z.string().optional(),
  parentId: z.number().int().min(1).optional(),
});

export type CreatePageDto = z.infer<typeof CreatePageSchema>;

// Update a standalone page. Omitting a field leaves it unchanged.
// `parentId: null` moves the page back to top level. `blocks` saves editor
// content (full replacement — Editor.js always saves the whole document).
export const UpdatePageSchema = z.object({
  title: z.string().nullish(),
  parentId: z.number().int().min(1).nullish(),
  blocks: z.array(EditorJsBlockSchema).optional(),
  version: z.string().optional(),
});

export type UpdatePageDto = z.infer<typeof UpdatePageSchema>;

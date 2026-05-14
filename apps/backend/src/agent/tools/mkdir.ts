import { z } from 'zod';
import { defineTool } from './base';

export const mkdirTool = defineTool({
  name: 'mkdir',
  description: 'Create a directory. Set recursive:true to create parents.',
  schema: z.object({
    path: z.string(),
    recursive: z.boolean().optional(),
  }),
  execute: async ({ path, recursive }, ctx) => {
    await ctx.sandbox.mkdir(path, { recursive: recursive ?? false });
    return { ok: true } as const;
  },
});

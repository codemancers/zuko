import { z } from 'zod';
import { defineTool } from './base';

const isDotEnv = (p: string) => /(^|\/)\.env(\.|$)/.test(p);

export const readTool = defineTool({
  name: 'read',
  description:
    'Read a file from the workspace. Use workspace-relative paths. Returns numbered lines (offset/limit available for long files).',
  schema: z.object({
    path: z.string(),
    offset: z.number().optional(),
    limit: z.number().optional(),
  }),
  needsApproval: ({ path }) => isDotEnv(path),
  execute: async ({ path, offset, limit }, ctx) => {
    const content = await ctx.sandbox.readFile(path, { offset, limit });
    return { content };
  },
});

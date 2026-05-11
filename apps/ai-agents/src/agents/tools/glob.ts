import { z } from 'zod';
import { defineTool } from './base';

export const globTool = defineTool({
  name: 'find_files',
  description:
    'Match files by glob pattern (supports ** for recursive). Returns workspace-relative paths.',
  schema: z.object({
    pattern: z.string(),
    cwd: z.string().optional(),
  }),
  execute: async ({ pattern, cwd }, ctx) => {
    const matches = await ctx.sandbox.glob(pattern, { cwd });
    return { matches };
  },
});

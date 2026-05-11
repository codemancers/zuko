import { z } from 'zod';
import { defineTool } from './base';

export const grepTool = defineTool({
  name: 'search_files',
  description:
    'Search files for a regex pattern. Returns up to 10 matches per file with line numbers.',
  schema: z.object({
    pattern: z.string(),
    path: z.string(),
    glob: z.string().optional(),
    caseSensitive: z.boolean().optional(),
  }),
  execute: async ({ pattern, path, glob, caseSensitive }, ctx) => {
    const matches = await ctx.sandbox.grep(pattern, {
      path,
      glob,
      caseSensitive,
    });
    return { matches };
  },
});

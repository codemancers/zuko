import { z } from 'zod';
import { defineTool } from './base';

const isDotEnv = (p: string) => /(^|\/)\.env(\.|$)/.test(p);

export const writeTool = defineTool({
  name: 'write',
  description:
    'Overwrite (or create) a file at the given workspace-relative path with the given content. For partial edits use the edit tool.',
  schema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  needsApproval: ({ path }) => isDotEnv(path),
  execute: async ({ path, content }, ctx) => {
    await ctx.sandbox.writeFile(path, content);
    return { ok: true } as const;
  },
});

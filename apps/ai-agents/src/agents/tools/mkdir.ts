import { z } from 'zod';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineTool } from './base';
import { WORKING_DIR } from './context';

export const mkdirTool = defineTool({
  name: 'mkdir',
  description: 'Create a directory. Set recursive:true to create parents.',
  schema: z.object({
    path: z.string(),
    recursive: z.boolean().optional(),
  }),
  execute: async ({ path, recursive }, ctx) => {
    const base = ctx.workingDirectory ?? WORKING_DIR;
    const abs = path.startsWith('/') ? path : resolve(base, path);
    mkdirSync(abs, { recursive: recursive ?? false });
    return { ok: true } as const;
  },
});

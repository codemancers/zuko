import { z } from 'zod';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { defineTool } from './base';
import { WORKING_DIR } from './context';

const isDotEnv = (p: string) => /(^|\/)\.env(\.|$)/.test(p);

export const writeTool = defineTool({
  name: 'write',
  description:
    'Overwrite (or create) a file at the given workspace-relative path with the given content. For partial edits use the edit tool.',
  schema: z.object({
    path: z.string(),
    content: z.string(),
    mkdirp: z.boolean().optional(),
  }),
  needsApproval: ({ path }) => isDotEnv(path),
  execute: async ({ path, content, mkdirp }, ctx) => {
    const base = ctx.workingDirectory ?? WORKING_DIR;
    const abs = path.startsWith('/') ? path : resolve(base, path);
    if (mkdirp) mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf-8');
    return { ok: true } as const;
  },
});

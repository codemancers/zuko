import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineTool } from './base';
import { WORKING_DIR } from './context';

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
    const base = ctx.workingDirectory ?? WORKING_DIR;
    const abs = path.startsWith('/') ? path : resolve(base, path);
    const raw = readFileSync(abs, 'utf-8');
    const lines = raw.split('\n');
    const start = offset ?? 0;
    const slice = limit != null ? lines.slice(start, start + limit) : lines.slice(start);
    const numbered = slice
      .map((line, i) => `${start + i + 1}\t${line}`)
      .join('\n');
    return { content: numbered, totalLines: lines.length };
  },
});

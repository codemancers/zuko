import { z } from 'zod';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineTool } from './base';
import { WORKING_DIR } from './context';

export const editTool = defineTool({
  name: 'edit',
  description:
    'Exact-string replace within a file. oldString must be unique unless replaceAll=true. Always read the file first.',
  schema: z.object({
    path: z.string(),
    oldString: z.string(),
    newString: z.string(),
    replaceAll: z.boolean().optional(),
  }),
  execute: async ({ path, oldString, newString, replaceAll }, ctx) => {
    if (oldString === newString) throw new Error('oldString and newString must differ');
    const base = ctx.workingDirectory ?? WORKING_DIR;
    const abs = path.startsWith('/') ? path : resolve(base, path);
    const original = readFileSync(abs, 'utf-8');

    let updated: string;
    if (replaceAll) {
      updated = original.split(oldString).join(newString);
    } else {
      const idx = original.indexOf(oldString);
      if (idx === -1) throw new Error(`oldString not found in ${path}`);
      const secondIdx = original.indexOf(oldString, idx + 1);
      if (secondIdx !== -1) {
        throw new Error(
          `oldString appears more than once in ${path}. Use replaceAll:true or provide more context.`,
        );
      }
      updated = original.slice(0, idx) + newString + original.slice(idx + oldString.length);
    }
    writeFileSync(abs, updated, 'utf-8');
    return { ok: true } as const;
  },
});

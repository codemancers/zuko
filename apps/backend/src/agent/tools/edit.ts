import { z } from 'zod';
import { defineTool } from './base';

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
    if (oldString === newString)
      throw new Error('oldString and newString must differ');
    const raw = await ctx.sandbox.readFile(path);
    // readFile returns numbered lines — strip line numbers to get raw content
    const original = raw.replace(/^\d+\t/gm, '');

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
      updated =
        original.slice(0, idx) +
        newString +
        original.slice(idx + oldString.length);
    }
    await ctx.sandbox.writeFile(path, updated);
    return { ok: true } as const;
  },
});

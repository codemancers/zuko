import { z } from 'zod';
import { defineTool } from './base';

export const statTool = defineTool({
  name: 'stat',
  description: 'Stat a file or directory: returns isFile, isDirectory, size, mtimeMs.',
  schema: z.object({ path: z.string() }),
  execute: async ({ path }, ctx) => {
    return ctx.sandbox.stat(path);
  },
});

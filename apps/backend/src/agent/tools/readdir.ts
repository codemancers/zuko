import { z } from 'zod';
import { defineTool } from './base';

export const readdirTool = defineTool({
  name: 'readdir',
  description:
    'List entries in a directory. Returns name + type (file/directory/symlink) for each entry.',
  schema: z.object({ path: z.string() }),
  execute: async ({ path }, ctx) => {
    return ctx.sandbox.readdir(path);
  },
});

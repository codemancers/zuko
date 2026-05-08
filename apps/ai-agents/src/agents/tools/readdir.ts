import { z } from 'zod';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineTool } from './base';
import { WORKING_DIR } from './context';

export const readdirTool = defineTool({
  name: 'readdir',
  description:
    'List entries in a directory. Returns name + type (file/directory/symlink) for each entry.',
  schema: z.object({ path: z.string() }),
  execute: async ({ path }, ctx) => {
    const base = ctx.workingDirectory ?? WORKING_DIR;
    const abs = path.startsWith('/') ? path : resolve(base, path);
    const entries = readdirSync(abs, { withFileTypes: true, encoding: 'utf-8' });
    return entries.map((e) => ({
      name: e.name,
      type: e.isFile() ? 'file' : e.isDirectory() ? 'directory' : 'symlink',
    }));
  },
});

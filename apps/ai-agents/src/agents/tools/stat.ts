import { z } from 'zod';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineTool } from './base';
import { WORKING_DIR } from './context';

export const statTool = defineTool({
  name: 'stat',
  description: 'Stat a file or directory: returns isFile, isDirectory, size, mtimeMs.',
  schema: z.object({ path: z.string() }),
  execute: async ({ path }, ctx) => {
    const base = ctx.workingDirectory ?? WORKING_DIR;
    const abs = path.startsWith('/') ? path : resolve(base, path);
    const s = statSync(abs);
    return {
      isFile: s.isFile(),
      isDirectory: s.isDirectory(),
      size: s.size,
      mtimeMs: s.mtimeMs,
    };
  },
});

import { z } from 'zod';
import { readdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { defineTool } from './base';
import { WORKING_DIR } from './context';

/** Simple glob matcher: supports * (any chars in segment) and ** (any path). */
function matchGlob(pattern: string, filePath: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex specials
    .replace(/\*\*/g, '\x00') // placeholder for **
    .replace(/\*/g, '[^/]*') // * matches within segment
    .replace(/\x00/g, '.*'); // ** matches any path
  return new RegExp(`^${regexStr}$`).test(filePath);
}

function walkDir(dir: string, rootDir: string, pattern: string, results: string[]) {
  let entries: import('node:fs').Dirent<string>[];
  try {
    entries = readdirSync(dir, { withFileTypes: true, encoding: 'utf-8' }) as import('node:fs').Dirent<string>[];
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') && !pattern.includes('/.')) continue; // skip hidden
    const abs = join(dir, e.name);
    const rel = relative(rootDir, abs);
    if (e.isDirectory()) {
      walkDir(abs, rootDir, pattern, results);
    } else if (matchGlob(pattern, rel)) {
      results.push(rel);
    }
  }
}

export const globTool = defineTool({
  name: 'glob',
  description:
    'Match files by glob pattern (supports ** for recursive). Returns workspace-relative paths.',
  schema: z.object({
    pattern: z.string(),
    cwd: z.string().optional(),
  }),
  execute: async ({ pattern, cwd }, ctx) => {
    const base = cwd
      ? (cwd.startsWith('/') ? cwd : resolve(ctx.workingDirectory ?? WORKING_DIR, cwd))
      : (ctx.workingDirectory ?? WORKING_DIR);
    const matches: string[] = [];
    walkDir(base, base, pattern, matches);
    return { matches };
  },
});

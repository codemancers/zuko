import { z } from 'zod';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { defineTool } from './base';
import { WORKING_DIR } from './context';

interface GrepMatch {
  file: string;
  line: number;
  content: string;
}

function matchGlob(pattern: string, filePath: string): boolean {
  if (!pattern) return true;
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\x00')
    .replace(/\*/g, '[^/]*')
    .replace(/\x00/g, '.*');
  return new RegExp(`^${regexStr}$`).test(filePath);
}

function grepFile(
  abs: string,
  rel: string,
  re: RegExp,
  max: number,
  results: GrepMatch[],
) {
  let content: string;
  try {
    content = readFileSync(abs, 'utf-8');
  } catch {
    return;
  }
  const lines = content.split('\n');
  let count = 0;
  for (let i = 0; i < lines.length && count < max; i++) {
    if (re.test(lines[i])) {
      results.push({ file: rel, line: i + 1, content: lines[i] });
      count++;
    }
  }
}

function walkAndGrep(
  dir: string,
  rootDir: string,
  globPattern: string | undefined,
  re: RegExp,
  max: number,
  results: GrepMatch[],
) {
  let entries: import('node:fs').Dirent<string>[];
  try {
    entries = readdirSync(dir, { withFileTypes: true, encoding: 'utf-8' }) as import('node:fs').Dirent<string>[];
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const abs = join(dir, e.name);
    const rel = relative(rootDir, abs);
    if (e.isDirectory()) {
      walkAndGrep(abs, rootDir, globPattern, re, max, results);
    } else if (matchGlob(globPattern ?? '*', rel)) {
      grepFile(abs, rel, re, 10, results);
    }
  }
}

export const grepTool = defineTool({
  name: 'grep',
  description:
    'Search files for a regex pattern. Returns up to 10 matches per file with line numbers.',
  schema: z.object({
    pattern: z.string(),
    path: z.string(),
    glob: z.string().optional(),
    caseSensitive: z.boolean().optional(),
    max: z.number().optional(),
  }),
  execute: async ({ pattern, path, glob, caseSensitive, max }, ctx) => {
    const base = ctx.workingDirectory ?? WORKING_DIR;
    const abs = path.startsWith('/') ? path : resolve(base, path);
    const flags = caseSensitive ? '' : 'i';
    const re = new RegExp(pattern, flags);
    const results: GrepMatch[] = [];
    const limit = max ?? 50;

    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(abs);
    } catch {
      return { matches: [] };
    }

    if (st.isDirectory()) {
      walkAndGrep(abs, abs, glob, re, limit, results);
    } else {
      grepFile(abs, relative(base, abs), re, limit, results);
    }
    return { matches: results };
  },
});

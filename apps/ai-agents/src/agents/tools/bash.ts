import { z } from 'zod';
import { defineTool } from './base';
import { WORKING_DIR } from './context';

const TIMEOUT_MS = 120_000;
const DANGEROUS_PATTERNS = [/\brm\s+-rf\b/];
const DOTENV_PATTERN = /(^|\s)\S*\.env(\.|\s|$)/;

export const bashTool = defineTool({
  name: 'bash',
  description:
    'Run a non-interactive shell command in the workspace. Returns combined stdout/stderr and exit code.',
  schema: z.object({
    command: z.string(),
    cwd: z.string().optional(),
    timeoutMs: z.number().optional(),
  }),
  needsApproval: ({ command }) =>
    DANGEROUS_PATTERNS.some((re) => re.test(command)) ||
    DOTENV_PATTERN.test(command),
  execute: async ({ command, cwd, timeoutMs }, ctx) => {
    const base = ctx.workingDirectory ?? WORKING_DIR;
    const workingCwd = cwd
      ? (cwd.startsWith('/') ? cwd : `${base}/${cwd}`)
      : base;
    return ctx.sandbox.exec(command, workingCwd, timeoutMs ?? TIMEOUT_MS, {
      signal: ctx.abortSignal,
    });
  },
});

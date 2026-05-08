import { z } from 'zod';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { defineTool } from './base';
import { WORKING_DIR } from './context';

const execAsync = promisify(exec);

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
    const workingCwd = cwd
      ? (cwd.startsWith('/') ? cwd : `${ctx.workingDirectory ?? WORKING_DIR}/${cwd}`)
      : (ctx.workingDirectory ?? WORKING_DIR);
    const timeout = timeoutMs ?? TIMEOUT_MS;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingCwd,
        timeout,
        env: { ...process.env },
      });
      return {
        success: true,
        exitCode: 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };
    } catch (err: any) {
      return {
        success: false,
        exitCode: err.code ?? 1,
        stdout: (err.stdout ?? '').trim(),
        stderr: (err.stderr ?? err.message ?? '').trim(),
      };
    }
  },
});

import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { backendFetch, crmOutput } from '../lib/backend';
import { MAX_FILE_BYTES } from '../lib/files';

const READ_ONLY_MESSAGE =
  'Choose a file in the session workspace outside private browser and runtime directories.';

export default defineTool({
  description:
    'Save a file from your sandbox into Zuko, so it can be attached to a record or a comment, or given to the user. Returns its id: attach it with update_record (a file field) or add_comment (file_ids). The file must be under /workspace and at most 25 MB. Make the filename descriptive. Never base64 or paste a file into a reply or a tool argument; save it, then refer to it by id.',
  inputSchema: z.object({
    path: z.string().startsWith('/workspace/').describe('Absolute path of the file in the sandbox.'),
    filename: z.string().min(1).max(180).optional().describe('Name to store it under; defaults to the file name.'),
  }),
  async execute({ path, filename }, ctx) {
    const sandbox = await ctx.getSandbox();
    // Resolve symlinks inside the sandbox first, so a path alias cannot reach private files.
    const checked = await sandbox.run({
      command: `python3 -c 'import os,json,stat; p=os.path.realpath(os.environ["ZUKO_SAVE_PATH"]); s=os.stat(p); assert stat.S_ISREG(s.st_mode); print(json.dumps({"path":p,"size":s.st_size}))'`,
      env: { ZUKO_SAVE_PATH: path },
    });
    if (checked.exitCode !== 0) return { zuko_error: { code: 'NOT_A_FILE', message: 'The file could not be read' } };
    const info = JSON.parse(checked.stdout) as { path: string; size: number };
    const relative = info.path.slice('/workspace/'.length);
    if (
      !info.path.startsWith('/workspace/') ||
      (!relative.startsWith('.eve/attachments/') && relative.split('/').some((part) => part.startsWith('.')))
    )
      return { zuko_error: { code: 'PATH_NOT_ALLOWED', message: READ_ONLY_MESSAGE } };
    if (info.size === 0) return { zuko_error: { code: 'EMPTY_FILE', message: 'The file is empty' } };
    if (info.size > MAX_FILE_BYTES)
      return { zuko_error: { code: 'FILE_TOO_LARGE', message: 'Files must be 25 MB or smaller' } };

    const stream = await sandbox.readFile({ path: info.path });
    if (!stream) return { zuko_error: { code: 'NOT_FOUND', message: 'The file no longer exists' } };
    const blob = await new Response(stream).blob();
    const form = new FormData();
    form.append('file', blob, filename || info.path.split('/').at(-1)!);
    const response = await backendFetch(ctx, 'files', {
      method: 'POST',
      body: form,
      json: false,
      timeoutMs: 120_000,
    });
    if (!(response instanceof Response)) return response;
    const result = await response.json().catch(() => null);
    if (!response.ok) return { zuko_error: result ?? { code: 'UPLOAD_FAILED', status: response.status } };
    return { file: result };
  },
  toModelOutput: crmOutput,
});

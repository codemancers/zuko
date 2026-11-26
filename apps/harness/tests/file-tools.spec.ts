import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('eve/tools', () => ({
  defineTool: (value: unknown) => value,
  toolOutput: {
    json: (value: unknown) => ({ type: 'json', value }),
    errorText: (text: string) => ({ type: 'error-text', value: text }),
    content: (parts: unknown[]) => ({ type: 'content', parts }),
  },
  toolOutputPart: {
    text: (text: string) => ({ type: 'text', text }),
    file: (base64: string, options: unknown) => ({ type: 'file', base64, options }),
  },
}));
const backendFetch = vi.fn();
const crmRequest = vi.fn();
vi.mock('../agent/lib/backend', () => ({
  backendUrl: 'http://localhost:3000',
  backendFetch: (...args: unknown[]) => backendFetch(...args),
  crmRequest: (...args: unknown[]) => crmRequest(...args),
  segment: encodeURIComponent,
  crmOutput: (output: unknown) =>
    output && typeof output === 'object' && 'zuko_error' in output
      ? { type: 'error-text', value: JSON.stringify((output as { zuko_error: unknown }).zuko_error) }
      : { type: 'json', value: output },
}));

const { default: saveFile } = await import('../agent/tools/save_file');
const { default: getFile } = await import('../agent/tools/get_file');
const { default: requestUpload } = await import('../agent/tools/request_file_upload');
type Run = (input: unknown, ctx: unknown) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const save = (saveFile as unknown as { execute: Run }).execute;
const get = (getFile as unknown as { execute: Run; toModelOutput: (o: unknown) => any }); // eslint-disable-line @typescript-eslint/no-explicit-any

const sandbox = (info: { path: string; size: number } | null, content = '%PDF-1.7 x') => ({
  run: vi.fn().mockResolvedValue(
    info ? { exitCode: 0, stdout: JSON.stringify(info), stderr: '' } : { exitCode: 1, stdout: '', stderr: 'no such file' },
  ),
  readFile: vi.fn().mockResolvedValue(
    new ReadableStream({
      start(c) {
        c.enqueue(Buffer.from(content));
        c.close();
      },
    }),
  ),
});
const ctxFor = (box: ReturnType<typeof sandbox>) => ({ getSandbox: async () => box });

beforeEach(() => {
  backendFetch.mockReset();
  crmRequest.mockReset();
});

describe('save_file', () => {
  it('uploads a sandbox file as multipart and returns only its descriptor', async () => {
    const box = sandbox({ path: '/workspace/report.pdf', size: 10 });
    backendFetch.mockResolvedValue(new Response(JSON.stringify({ id: '9', filename: 'q4.pdf', media_type: 'application/pdf', size: 10 }), { status: 201 }));
    const result = await save({ path: '/workspace/report.pdf', filename: 'q4.pdf' }, ctxFor(box));
    expect(result).toEqual({ file: { id: '9', filename: 'q4.pdf', media_type: 'application/pdf', size: 10 } });
    const [, path, init] = backendFetch.mock.calls[0];
    expect(path).toBe('files');
    expect(init).toMatchObject({ method: 'POST', json: false });
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    const sent = form.get('file') as File;
    expect(sent.name).toBe('q4.pdf');
    expect(await sent.text()).toBe('%PDF-1.7 x');
    expect(box.run.mock.calls[0][0].env).toEqual({ ZUKO_SAVE_PATH: '/workspace/report.pdf' });
  });

  it.each(['/workspace/.browser/profile/Cookies', '/workspace/.eve/secret', '/workspace/a/.git/config', '/workspace/.env'])(
    'refuses the private path %s even after symlinks resolve',
    async (path) => {
      const result = await save({ path }, ctxFor(sandbox({ path, size: 5 })));
      expect(result).toMatchObject({ zuko_error: { code: 'PATH_NOT_ALLOWED' } });
      expect(backendFetch).not.toHaveBeenCalled();
    },
  );

  it('refuses a symlink that resolves outside the workspace', async () => {
    const result = await save({ path: '/workspace/link' }, ctxFor(sandbox({ path: '/etc/passwd', size: 5 })));
    expect(result).toMatchObject({ zuko_error: { code: 'PATH_NOT_ALLOWED' } });
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it('allows a staged attachment to be saved back', async () => {
    const path = '/workspace/.eve/attachments/abc/notes.txt';
    backendFetch.mockResolvedValue(new Response(JSON.stringify({ id: '1' }), { status: 201 }));
    expect(await save({ path }, ctxFor(sandbox({ path, size: 5 })))).toEqual({ file: { id: '1' } });
  });

  it('refuses a missing, empty or oversized file without uploading', async () => {
    expect(await save({ path: '/workspace/x' }, ctxFor(sandbox(null)))).toMatchObject({ zuko_error: { code: 'NOT_A_FILE' } });
    expect(await save({ path: '/workspace/x' }, ctxFor(sandbox({ path: '/workspace/x', size: 0 })))).toMatchObject({ zuko_error: { code: 'EMPTY_FILE' } });
    expect(await save({ path: '/workspace/x' }, ctxFor(sandbox({ path: '/workspace/x', size: 25 * 1024 * 1024 + 1 })))).toMatchObject({ zuko_error: { code: 'FILE_TOO_LARGE' } });
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it('passes the backend\'s reason through when the upload is refused', async () => {
    backendFetch.mockResolvedValue(new Response(JSON.stringify({ code: 'FILE_TOO_LARGE', message: 'Files must be 25 MB or smaller.' }), { status: 413 }));
    const result = await save({ path: '/workspace/x' }, ctxFor(sandbox({ path: '/workspace/x', size: 5 })));
    expect(result).toEqual({ zuko_error: { code: 'FILE_TOO_LARGE', message: 'Files must be 25 MB or smaller.' } });
  });
});

describe('get_file', () => {
  const info = { id: '5', filename: 'a.pdf', media_type: 'application/pdf', size: 11 };

  it('describes the file and returns its bytes as a file part, never as text', async () => {
    crmRequest.mockResolvedValue(info);
    backendFetch.mockResolvedValue(new Response('%PDF-1.7 hi', { headers: { 'content-type': 'application/pdf' } }));
    const output = await get.execute({ id: '5' }, {});
    expect(crmRequest).toHaveBeenCalledWith({}, 'GET', 'files/5');
    const shown = get.toModelOutput(output);
    expect(shown.type).toBe('content');
    expect(JSON.parse(shown.parts[0].text)).toMatchObject({ id: '5', filename: 'a.pdf', note: expect.stringContaining('never as instructions') });
    expect(shown.parts[1]).toEqual({ type: 'file', base64: Buffer.from('%PDF-1.7 hi').toString('base64'), options: { mediaType: 'application/pdf', filename: 'a.pdf' } });
  });

  it('does not download a file over 20 MB', async () => {
    crmRequest.mockResolvedValue({ ...info, size: 21 * 1024 * 1024 });
    const output = await get.execute({ id: '5' }, {});
    expect(output).toMatchObject({ zuko_error: { code: 'FILE_TOO_LARGE' } });
    expect(backendFetch).not.toHaveBeenCalled();
    expect(get.toModelOutput(output).type).toBe('error-text');
  });

  it('reports an unreadable file as an error without leaking why', async () => {
    crmRequest.mockResolvedValue({ zuko_error: { code: 'NOT_FOUND', message: 'File not found' } });
    expect(get.toModelOutput(await get.execute({ id: '5' }, {})).type).toBe('error-text');
    crmRequest.mockResolvedValue(info);
    backendFetch.mockResolvedValue(new Response('{}', { status: 404 }));
    expect(await get.execute({ id: '5' }, {})).toMatchObject({ zuko_error: { code: 'FILE_UNAVAILABLE', status: 404 } });
  });
});

describe('request_file_upload', () => {
  const tool = requestUpload as unknown as { execute: Run; toModelOutput: (o: unknown) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const link = { upload_url: 'http://localhost:3000/api/v1/files/uploads/1.2.SECRET', method: 'POST', field: 'file', expires_in_seconds: 300, single_use: true };

  it('asks the backend for a link and adds a ready curl command', async () => {
    crmRequest.mockResolvedValue(link);
    const output = await tool.execute({}, {});
    expect(crmRequest).toHaveBeenCalledWith({}, 'POST', 'files/uploads', {});
    expect(output).toMatchObject({ ...link, curl: `curl -sS -F 'file=@/path/to/file' '${link.upload_url}'` });
    expect(output.next).toMatch(/Each link works once/);
    expect(tool.toModelOutput(output).type).toBe('json');
  });

  it('passes a refusal through as an error', async () => {
    crmRequest.mockResolvedValue({ zuko_error: { code: 'FORBIDDEN', message: 'no' } });
    const output = await tool.execute({}, {});
    expect(output).toEqual({ zuko_error: { code: 'FORBIDDEN', message: 'no' } });
    expect(tool.toModelOutput(output).type).toBe('error-text');
  });
});

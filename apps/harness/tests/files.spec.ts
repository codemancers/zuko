import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('eve/channels', () => ({ attachmentError: (message: string) => new Error(message) }));
const backendFetch = vi.fn();
vi.mock('../agent/lib/backend', () => ({
  backendUrl: 'http://localhost:3000',
  backendFetch: (...args: unknown[]) => backendFetch(...args),
}));

const { fileIdFromUrl, fileProblems, resolveUploadedFile } = await import('../agent/lib/files');
const fileContentUrl = (id: string) => `http://localhost:3000/api/v1/files/${id}/content`;

const ctx = { state: {}, session: { auth: { current: { principalType: 'user', attributes: {} } } } };
const resolve = resolveUploadedFile as (url: string, c?: unknown) => Promise<{ bytes: Buffer; mediaType?: string; filename?: string }>;

describe('fileIdFromUrl', () => {
  it('recognizes only the backend\'s own file content URLs', () => {
    expect(fileIdFromUrl('http://localhost:3000/api/v1/files/42/content')).toBe('42');
    expect(fileIdFromUrl(fileContentUrl('7'))).toBe('7');
  });

  it('refuses everything else', () => {
    for (const url of [
      'https://evil.example/api/v1/files/42/content',
      'http://localhost:3001/api/v1/files/42/content',
      'http://user:pw@localhost:3000/api/v1/files/42/content',
      'http://localhost:3000/api/v1/files/42/content?x=1',
      'http://localhost:3000/api/v1/files/42/content#x',
      'http://localhost:3000/api/v1/files/42',
      'http://localhost:3000/api/v1/files/abc/content',
      'http://localhost:3000/api/v1/files/0/content',
      'http://localhost:3000/api/v1/files/42/content/../../x',
      'data:application/pdf;base64,JVBERi0=',
      'JVBERi0xLjQK',
      'file:///etc/passwd',
      '',
      42,
      undefined,
    ]) {
      expect(fileIdFromUrl(url as string)).toBeUndefined();
    }
  });
});

describe('fileProblems', () => {
  const part = (data: unknown, filename = 'a.pdf') => ({ type: 'file', mediaType: 'application/pdf', filename, data });

  it('accepts text, and files sent by Zuko link', () => {
    expect(fileProblems('hello')).toEqual([]);
    expect(fileProblems([{ type: 'text', text: 'hi' }, part(fileContentUrl('1'))])).toEqual([]);
  });

  it('refuses inline content in any form, and links that are not Zuko\'s', () => {
    for (const data of ['data:application/pdf;base64,JVBERi0=', 'JVBERi0xLjQK', 'https://example.com/a.pdf', 'eve-url:x', new Uint8Array([1])]) {
      expect(fileProblems([part(data, 'contract.pdf')])).toEqual([
        expect.stringContaining('"contract.pdf" must be uploaded to Zuko first'),
      ]);
    }
  });

  it('reports each offending part, and too many files', () => {
    expect(fileProblems([part('x'), part(fileContentUrl('1')), part('y')])).toHaveLength(2);
    const eleven = Array.from({ length: 11 }, (_, i) => part(fileContentUrl(String(i + 1))));
    expect(fileProblems(eleven)).toEqual([expect.stringContaining('at most 10 files')]);
  });
});

describe('resolveUploadedFile', () => {
  beforeEach(() => backendFetch.mockReset());

  it('fetches the bytes as the signed-in user and returns the stored type and name', async () => {
    backendFetch.mockResolvedValue(
      new Response(Buffer.from('%PDF-1.7 x'), {
        headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="r.pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf` },
      }),
    );
    const file = await resolve(fileContentUrl('42'), ctx);
    expect(file.bytes.toString()).toBe('%PDF-1.7 x');
    expect(file).toMatchObject({ mediaType: 'application/pdf', filename: 'résumé.pdf' });
    expect(backendFetch).toHaveBeenCalledWith(ctx, 'files/42/content', expect.objectContaining({ method: 'GET', json: false }));
  });

  it('never fetches a URL that is not Zuko\'s own', async () => {
    await expect(resolve('https://evil.example/a.pdf', ctx)).rejects.toThrow('Only files uploaded to Zuko');
    await expect(resolve('http://localhost:3000/api/v1/records', ctx)).rejects.toThrow('Only files uploaded to Zuko');
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it('needs a context, and reports a file the user cannot read without saying why', async () => {
    await expect(resolve(fileContentUrl('42'))).rejects.toThrow('Sign in');
    backendFetch.mockResolvedValue(new Response('{}', { status: 404 }));
    await expect(resolve(fileContentUrl('42'), ctx)).rejects.toThrow('unavailable, or you cannot read it');
  });

  it('reports a refused delegation', async () => {
    backendFetch.mockResolvedValue({ zuko_error: { code: 'DELEGATION_REFUSED' } });
    await expect(resolve(fileContentUrl('42'), ctx)).rejects.toThrow('could not authorize');
  });

  it('refuses a body over the limit', async () => {
    backendFetch.mockResolvedValue(new Response(Buffer.alloc(25 * 1024 * 1024 + 1)));
    await expect(resolve(fileContentUrl('42'), ctx)).rejects.toThrow('25 MB');
  });
});

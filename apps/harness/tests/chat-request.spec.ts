import { describe, expect, it, vi } from 'vitest';

vi.mock('eve/channels', () => ({ attachmentError: (message: string) => new Error(message) }));
vi.mock('../agent/lib/backend', () => ({ backendUrl: 'http://localhost:3000', backendFetch: vi.fn() }));

const { requestFileProblems, CHAT_BODY_LIMIT, INLINE_FILE_MESSAGE } = await import('../agent/lib/chat-request');

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost:4200/eve/v1/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const link = 'http://localhost:3000/api/v1/files/7/content';
const file = (data: string) => ({ type: 'file', mediaType: 'text/plain', filename: 'n.txt', data });

describe('requestFileProblems', () => {
  it('lets plain messages and Zuko file links through', async () => {
    expect(await requestFileProblems(post({ message: 'hello' }))).toEqual([]);
    expect(await requestFileProblems(post({ message: [{ type: 'text', text: 'hi' }, file(link)] }))).toEqual([]);
    expect(await requestFileProblems(post({ answers: [{ interactionId: 'a', optionId: 'approve' }] }))).toEqual([]);
  });

  it('refuses inline content, other links and look-alikes, naming the file', async () => {
    for (const data of ['JVBERi0xLjQK', 'data:text/plain;base64,aGk=', 'https://example.com/a.txt', `${link}?x=1`]) {
      const problems = await requestFileProblems(post({ message: [file(data)] }));
      expect(problems).toEqual([expect.stringContaining('"n.txt" must be uploaded to Zuko first')]);
    }
  });

  it('refuses a body too large to be anything but file contents', async () => {
    expect(await requestFileProblems(post({ message: 'x'.repeat(CHAT_BODY_LIMIT + 10) }))).toEqual([INLINE_FILE_MESSAGE]);
    expect(await requestFileProblems(post('{}', { 'content-length': String(CHAT_BODY_LIMIT + 1) }))).toEqual([INLINE_FILE_MESSAGE]);
  });

  it('leaves invalid or empty bodies to eve, and does not consume the request', async () => {
    expect(await requestFileProblems(post('not json'))).toEqual([]);
    expect(await requestFileProblems(new Request('http://localhost/x', { method: 'POST' }))).toEqual([]);
    expect(await requestFileProblems(post('[]'))).toEqual([]);
    const request = post({ message: 'still readable' });
    await requestFileProblems(request);
    expect(await request.json()).toEqual({ message: 'still readable' });
  });
});

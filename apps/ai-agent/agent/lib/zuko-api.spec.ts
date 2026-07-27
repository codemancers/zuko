import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchClaudeOauth } from './zuko-api.js';

describe('fetchClaudeOauth', () => {
  beforeEach(() => {
    process.env['BETTER_AUTH_SECRET'] = 'test-secret';
    process.env['ZUKO_BACKEND_URL'] = 'http://backend.test';
  });
  afterEach(() => vi.restoreAllMocks());

  it('GETs the claude-oauth route with an EvePrincipal header and returns the blob', async () => {
    const blob = { accessToken: 'a' };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(blob), { status: 200 }));
    const out = await fetchClaudeOauth({ userId: 5, orgId: 2 });
    expect(out).toEqual(blob);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://backend.test/api/internal/eve/claude-oauth');
    expect((init!.headers as Record<string, string>).Authorization).toMatch(
      /^EvePrincipal /,
    );
  });

  it('throws on a non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Claude not connected. Add it under Settings.', {
        status: 401,
      }),
    );
    await expect(fetchClaudeOauth({ userId: 5, orgId: 2 })).rejects.toThrow(
      /401/,
    );
  });
});

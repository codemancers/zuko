import { clearEveAccessTokens, getEveAccessToken } from './eve-auth';

describe('Eve browser authentication', () => {
  beforeEach(() => {
    clearEveAccessTokens();
    vi.restoreAllMocks();
  });

  it('requires an active user and organization scope', async () => {
    await expect(getEveAccessToken('')).rejects.toThrow('active Zuko organization');
  });

  it('exchanges the session cookie and caches a fresh token per scope', async () => {
    const request = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ access_token: 'route-token', expires_at: Date.now() + 60_000 }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    await expect(getEveAccessToken('user-1:org-1')).resolves.toBe('route-token');
    await expect(getEveAccessToken('user-1:org-1')).resolves.toBe('route-token');

    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/eve/token',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('reports backend errors and rejects invalid token responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Agent unavailable' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(getEveAccessToken('scope')).rejects.toThrow('Agent unavailable');

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: '', expires_at: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(getEveAccessToken('scope')).rejects.toThrow('invalid access token');
  });
});

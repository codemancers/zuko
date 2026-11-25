import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { ToolContext } from 'eve/tools';
import { crmRequest, grantClaim, orgClaim } from '../agent/lib/backend';
let sequence = 0;
const context = () =>
  ({
    session: {
      auth: {
        current: {
          principalType: 'user',
          attributes: { [grantClaim]: `cache-test-${++sequence}`, [orgClaim]: '1' },
        },
      },
    },
    abortSignal: new AbortController().signal,
  }) as unknown as ToolContext;
const delegated = () =>
  Response.json({ access_token: 'short-token', expires_at: Date.now() + 60_000 });
beforeEach(() => vi.stubEnv('EVE_AUTH_SECRET', 'test-service-key-with-more-than-32-bytes'));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('CRM transport', () => {
  it('reuses a short token but honors a backend revocation and drops the cache', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(delegated())
      .mockResolvedValueOnce(Response.json({ id: '1' }))
      .mockResolvedValueOnce(Response.json({ code: 'UNAUTHORIZED' }, { status: 401 }))
      .mockResolvedValueOnce(new Response('', { status: 401 }));
    vi.stubGlobal('fetch', fetcher);
    const ctx = context();
    expect(await crmRequest(ctx, 'GET', 'objects/contact/records/1')).toEqual({ id: '1' });
    expect(await crmRequest(ctx, 'GET', 'objects/contact/records/1')).toMatchObject({
      zuko_error: { code: 'UNAUTHORIZED' },
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(await crmRequest(ctx, 'GET', 'objects/contact/records/1')).toMatchObject({
      zuko_error: { code: 'DELEGATION_REFUSED' },
    });
    expect(fetcher.mock.calls[3][0]).toContain('/harness/delegate');
  });
  it.each([502, 200])(
    'reports non-JSON upstream responses without exposing HTML (%s)',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(delegated())
          .mockResolvedValueOnce(new Response('<html>private proxy detail</html>', { status })),
      );
      const result = await crmRequest(context(), 'GET', 'objects/contact/records');
      expect(result).toMatchObject({ zuko_error: { code: 'UPSTREAM_ERROR', status } });
      expect(JSON.stringify(result)).not.toContain('private proxy detail');
    },
  );
  it('accepts an empty 204 and handles invalid delegation responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(delegated())
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(Response.json({ access_token: null })),
    );
    expect(await crmRequest(context(), 'DELETE', 'objects/contact/records/1')).toBeNull();
    expect(await crmRequest(context(), 'GET', 'objects/contact/records')).toMatchObject({
      zuko_error: { code: 'UPSTREAM_ERROR' },
    });
  });
  it('refreshes expired tokens and keeps organizations/grants isolated', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi
        .fn()
        .mockImplementation(async (url: string) =>
          url.endsWith('/harness/delegate') ? delegated() : Response.json({ results: [] }),
        );
      vi.stubGlobal('fetch', fetcher);
      const ctx = context();
      await crmRequest(ctx, 'GET', 'objects/contact/records');
      vi.advanceTimersByTime(56_000);
      await crmRequest(ctx, 'GET', 'objects/contact/records');
      await crmRequest(context(), 'GET', 'objects/contact/records');
      expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/harness/delegate'))).toHaveLength(
        3,
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

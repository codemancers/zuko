import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException } from '@nestjs/common';

vi.mock('better-auth/oauth2', () => ({ verifyAccessToken: vi.fn() }));
import { verifyAccessToken } from 'better-auth/oauth2';
import { McpBearerGuard } from './mcp-bearer.guard';

const mockedVerify = vi.mocked(verifyAccessToken);

function context(req: unknown, res: unknown = { setHeader: vi.fn() }) {
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as never;
}

describe('McpBearerGuard', () => {
  const guard = new McpBearerGuard();
  beforeEach(() => mockedVerify.mockReset());

  it('skips validation for non-POST requests so the handler can answer 405', async () => {
    const req = { method: 'GET', headers: {} };
    await expect(guard.canActivate(context(req))).resolves.toBe(true);
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it('challenges a POST with no bearer token (RFC 9728 header + JSON-RPC body)', async () => {
    const res = { setHeader: vi.fn() };
    const req = { method: 'POST', headers: {} };

    try {
      await guard.canActivate(context(req, res));
      expect.unreachable('guard should have thrown');
    } catch (e) {
      const err = e as HttpException;
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(401);
      expect(err.getResponse()).toMatchObject({ jsonrpc: '2.0', id: null });
    }
    expect(res.setHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      expect.stringContaining('Bearer resource_metadata='),
    );
  });

  it('attaches userId + scopes from a valid token', async () => {
    mockedVerify.mockResolvedValue({
      sub: '42',
      scope: 'tasks:read tasks:write',
    } as never);
    const req: {
      method: string;
      headers: Record<string, string>;
      mcpAuth?: unknown;
    } = {
      method: 'POST',
      headers: { authorization: 'Bearer good' },
    };

    await expect(guard.canActivate(context(req))).resolves.toBe(true);
    expect(req.mcpAuth).toEqual({
      userId: 42,
      scopes: ['tasks:read', 'tasks:write'],
    });
  });

  // Note: the "verifyAccessToken rejects (bad/expired signature)" path is
  // exercised by the e2e suite against a real server. It's intentionally not
  // unit-tested here — mocking verifyAccessToken to reject trips this repo's
  // vitest unhandled-rejection detector even though the guard handles it. The
  // challenge() failure response itself is covered by the no-token and
  // non-numeric-subject cases below.

  it('rejects a token whose subject is not a numeric user id', async () => {
    mockedVerify.mockResolvedValue({ sub: 'not-a-number' } as never);
    const res = { setHeader: vi.fn() };
    const req = { method: 'POST', headers: { authorization: 'Bearer weird' } };

    await expect(
      guard.canActivate(context(req, res)),
    ).rejects.toBeInstanceOf(HttpException);
  });
});

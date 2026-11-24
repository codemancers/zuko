import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  EVE_ISSUER,
  EVE_ORGANIZATION_CLAIM,
  EVE_USER_CLAIM,
  eveSubject,
  issueEveRouteToken,
  verifyEveMcpToken,
} from './tokens';
import { MCP_RESOURCE } from '../better-auth/constants';

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

function token(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    iss: EVE_ISSUER,
    aud: MCP_RESOURCE,
    sub: eveSubject(7n, 11n),
    iat: now,
    exp: now + 60,
    jti: 'test',
    [EVE_USER_CLAIM]: '7',
    [EVE_ORGANIZATION_CLAIM]: '11',
    scope: 'mcp:read mcp:write mcp:delete',
    ...overrides,
  });
  const unsigned = `${header}.${payload}`;
  const signature = createHmac('sha256', 'test-eve-secret-at-least-32-bytes')
    .update(unsigned)
    .digest('base64url');
  return `${unsigned}.${signature}`;
}

describe('Eve tokens', () => {
  beforeEach(() => {
    vi.stubEnv('EVE_AUTH_SECRET', 'test-eve-secret-at-least-32-bytes');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('issues a short-lived route token scoped to a user and organization', () => {
    const issued = issueEveRouteToken(7n, 11n);
    expect(issued?.token.split('.')).toHaveLength(3);
    expect(issued!.expiresAt - Date.now()).toBeGreaterThan(4 * 60 * 1000);
  });

  it('accepts a valid internal MCP delegation token', () => {
    expect(verifyEveMcpToken(token())).toMatchObject({
      sub: 'user:7:organization:11',
      zuko_user_id: '7',
      zuko_organization_id: '11',
    });
  });

  it.each([
    ['wrong audience', { aud: 'https://example.invalid' }],
    ['expired', { exp: 1 }],
    ['changed subject', { sub: 'user:7:organization:12' }],
    ['unknown scope', { scope: 'mcp:read superuser' }],
    ['missing read scope', { scope: 'mcp:write' }],
  ])('rejects %s', (_name, claims) => {
    expect(verifyEveMcpToken(token(claims))).toBeUndefined();
  });

  it('rejects a changed signature and fails closed without a secret', () => {
    expect(verifyEveMcpToken(`${token()}x`)).toBeUndefined();
    vi.stubEnv('EVE_AUTH_SECRET', '');
    expect(issueEveRouteToken(7n, 11n)).toBeUndefined();
    expect(verifyEveMcpToken(token())).toBeUndefined();

    vi.stubEnv('EVE_AUTH_SECRET', 'too-short');
    expect(issueEveRouteToken(7n, 11n)).toBeUndefined();
  });
});

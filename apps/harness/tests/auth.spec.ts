import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyBearerToken } from 'better-auth/oauth2';
import { zukoAuth } from '../agent/lib/auth';
import {
  grantClaim,
  orgClaim,
  issuer,
  backendUrl,
  mcpResource,
  frontendUrl,
} from '../agent/lib/backend';

vi.mock('better-auth/oauth2', () => ({ verifyBearerToken: vi.fn() }));
const claims = {
  sub: '1',
  [orgClaim]: '2',
  [grantClaim]: 'opaque-grant',
  scope: 'records:read',
};
const request = (name = 'list_records') =>
  new Request('http://localhost/eve/v1/mcp', {
    method: 'POST',
    headers: { authorization: 'Bearer test-token' },
    body: JSON.stringify({ method: 'tools/call', params: { name } }),
  });

beforeEach(() => {
  vi.mocked(verifyBearerToken).mockReset();
  vi.mocked(verifyBearerToken).mockResolvedValue(claims);
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Unexpected backend request');
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('local harness authentication', () => {
  it.each([false, true])(
    'authenticates browser=%s from verified claims without a backend call',
    async (browser) => {
      const principal = await zukoAuth(browser)(request());
      expect(principal).toMatchObject({
        subject: '1',
        principalType: 'user',
        principalId: 'user:1:organization:2:grant:opaque-grant',
        attributes: { [grantClaim]: 'opaque-grant', [orgClaim]: '2' },
      });
      expect(verifyBearerToken).toHaveBeenCalledWith('test-token', {
        jwksUrl: `${backendUrl}/auth/jwks`,
        verifyOptions: {
          issuer,
          audience: browser ? `${frontendUrl}/eve` : mcpResource,
          algorithms: ['EdDSA', 'ES256', 'RS256'],
        },
      });
      expect(fetch).not.toHaveBeenCalled();
      expect(JSON.stringify(principal)).not.toContain('test-token');
    },
  );

  it.each([{ sub: '' }, { [orgClaim]: 'not-an-id' }, { [grantClaim]: undefined }])(
    'rejects missing or invalid identity claims: %j',
    async (override) => {
      vi.mocked(verifyBearerToken).mockResolvedValue({ ...claims, ...override });
      expect(await zukoAuth(false)(request())).toBeNull();
    },
  );

  it('rejects direct mutations without their signed scope', async () => {
    await expect(zukoAuth(false)(request('create_record'))).rejects.toThrow(
      'records:write is required',
    );
    await expect(zukoAuth(false)(request('agent_start'))).rejects.toThrow(
      'agent:invoke is required',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects invalid JWTs and propagates verifier outages', async () => {
    vi.mocked(verifyBearerToken).mockRejectedValue({
      status: 'UNAUTHORIZED',
      body: { error: 'invalid_token' },
    });
    expect(await zukoAuth(false)(request())).toBeNull();
    vi.mocked(verifyBearerToken).mockRejectedValue(new Error('JWKS unavailable'));
    await expect(zukoAuth(false)(request())).rejects.toThrow('JWKS unavailable');
  });
});

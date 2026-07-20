import { createHmac } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { signEvePrincipal, verifyEvePrincipal } from './eve-principal';

describe('eve-principal', () => {
  beforeEach(() => {
    process.env['BETTER_AUTH_SECRET'] = 'test-secret';
  });

  it('round-trips a signed principal', () => {
    const token = signEvePrincipal({ userId: 7, orgId: 3 });
    expect(verifyEvePrincipal(token)).toEqual({ userId: 7, orgId: 3 });
  });

  it('rejects a tampered signature', () => {
    const token = signEvePrincipal({ userId: 7, orgId: 3 });
    const forged = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
    expect(() => verifyEvePrincipal(forged)).toThrow(/invalid signature/);
  });

  it('rejects an expired token', () => {
    const stale = Buffer.from(
      JSON.stringify({ userId: 7, orgId: 3, iat: Date.now() - 120_000 }),
    ).toString('base64url');
    const sig = createHmac('sha256', 'test-secret').update(stale).digest('hex');
    expect(() => verifyEvePrincipal(`${stale}.${sig}`)).toThrow(/expired/);
  });

  it('rejects a malformed token', () => {
    expect(() => verifyEvePrincipal('no-dot')).toThrow(/malformed/);
  });
});

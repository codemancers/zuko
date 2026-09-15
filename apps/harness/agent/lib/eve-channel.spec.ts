import { describe, it, expect, beforeEach } from 'vitest';
import { signEvePrincipal } from './eve-principal.js';
import { trustedHeaderAuth } from '../channels/eve.js';

describe('trustedHeaderAuth', () => {
  beforeEach(() => {
    process.env['BETTER_AUTH_SECRET'] = 'test-secret';
  });

  it('maps a valid x-eve-principal to a session principal', () => {
    const token = signEvePrincipal({ userId: 9, orgId: 4 });
    const req = new Request('http://x', {
      headers: { 'x-eve-principal': token },
    });
    const p = trustedHeaderAuth(req);
    expect(p).toMatchObject({
      principalId: '9',
      principalType: 'user',
      attributes: { orgId: '4' },
    });
  });

  it('returns null when the header is absent (→ 401, no fallback)', () => {
    expect(trustedHeaderAuth(new Request('http://x'))).toBeNull();
  });

  it('returns null on a forged header (clean 401, not 500)', () => {
    const req = new Request('http://x', {
      headers: { 'x-eve-principal': 'bad.sig' },
    });
    expect(trustedHeaderAuth(req)).toBeNull();
  });
});

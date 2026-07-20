import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildUpstreamHeaders } from './eve-proxy-headers';
import { verifyEvePrincipal } from '../utils/eve-principal';

describe('buildUpstreamHeaders', () => {
  beforeEach(() => {
    process.env['BETTER_AUTH_SECRET'] = 'test-secret';
  });

  afterEach(() => {
    delete process.env['BETTER_AUTH_SECRET'];
  });

  it('strips all five sensitive headers: cookie, authorization, host, content-length, connection', () => {
    const out = buildUpstreamHeaders(
      {
        cookie: 's=1',
        authorization: 'Bearer x',
        host: 'h',
        'content-length': '3',
        connection: 'keep-alive',
        'content-type': 'application/json',
      },
      { userId: 7, orgId: 3 },
    );
    expect(out).not.toHaveProperty('cookie');
    expect(out).not.toHaveProperty('authorization');
    expect(out).not.toHaveProperty('host');
    expect(out).not.toHaveProperty('content-length');
    expect(out).not.toHaveProperty('connection');
    expect(out['content-type']).toBe('application/json');
  });

  it('strips headers case-insensitively (Cookie, AUTHORIZATION)', () => {
    const out = buildUpstreamHeaders(
      {
        Cookie: 's=1',
        AUTHORIZATION: 'Bearer x',
        'content-type': 'application/json',
      },
      { userId: 7, orgId: 3 },
    );
    expect(out).not.toHaveProperty('Cookie');
    expect(out).not.toHaveProperty('AUTHORIZATION');
    expect(out['content-type']).toBe('application/json');
  });

  it('joins array-valued headers with comma', () => {
    const out = buildUpstreamHeaders(
      {
        'x-forwarded-for': ['a', 'b'] as never,
        'content-type': 'application/json',
      },
      { userId: 7, orgId: 3 },
    );
    expect(out['x-forwarded-for']).toBe('a,b');
  });

  it('skips headers with undefined values', () => {
    const out = buildUpstreamHeaders(
      {
        'x-skip': undefined as never,
        'content-type': 'application/json',
      },
      { userId: 7, orgId: 3 },
    );
    expect(out).not.toHaveProperty('x-skip');
    expect(out['content-type']).toBe('application/json');
  });

  it('stamps a verifiable x-eve-principal', () => {
    const out = buildUpstreamHeaders({}, { userId: 7, orgId: 3 });
    expect(verifyEvePrincipal(out['x-eve-principal'])).toEqual({
      userId: 7,
      orgId: 3,
    });
  });

  it('strips any client-supplied x-eve-principal (any casing) before stamping the signed one', () => {
    const out = buildUpstreamHeaders(
      {
        'x-eve-principal': 'forged',
        'X-Eve-Principal': 'forged2',
      },
      { userId: 7, orgId: 3 },
    );
    expect(
      Object.keys(out).filter((k) => k.toLowerCase() === 'x-eve-principal'),
    ).toHaveLength(1);
    expect(verifyEvePrincipal(out['x-eve-principal'])).toEqual({
      userId: 7,
      orgId: 3,
    });
  });
});

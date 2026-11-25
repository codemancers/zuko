import { afterEach, describe, expect, it, vi } from 'vitest';
import { HarnessGrantsService, GRANT_CLAIM } from './harness-grants.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthService } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../better-auth/auth';
import { ORG_CLAIM } from '../better-auth/constants';
const service = () => new HarnessGrantsService({} as PrismaService, {} as AuthService<Auth>);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('CRM token scopes', () => {
  it('intersects backend-issued CRM token scopes with the live grant scopes', async () => {
    const grants = service();
    vi.spyOn(grants, 'verify').mockResolvedValue({
      sub: '1',
      [GRANT_CLAIM]: 'ref',
      [ORG_CLAIM]: '2',
      scope: 'records:read',
    });
    const grant = { userId: 1n, organizationId: 2n, scopes: ['records:read', 'records:write'] };
    vi.spyOn(grants, 'resolve').mockResolvedValue(
      grant as Awaited<ReturnType<HarnessGrantsService['resolve']>>,
    );
    await expect(grants.delegation('token', 'records:write')).rejects.toThrow(
      /requires records:write/,
    );
    await expect(grants.delegation('token', 'records:read')).resolves.toBe(grant);
    grant.scopes = [];
    await expect(grants.delegation('token', 'records:read')).rejects.toThrow(
      /requires records:read/,
    );
  });
});

describe('delegation service boundary', () => {
  const key = 'test-service-secret-at-least-thirty-two-bytes';
  it('supports staged key rotation and rejects unrelated credentials', () => {
    vi.stubEnv('EVE_AUTH_SECRET', key);
    vi.stubEnv('EVE_AUTH_SECRET_PREVIOUS', 'previous-service-secret-at-least-thirty-two-bytes');
    const grants = service();
    expect(() => grants.requireService(key)).not.toThrow();
    expect(() => grants.requireService(process.env.EVE_AUTH_SECRET_PREVIOUS)).not.toThrow();
    expect(() => grants.requireService('wrong')).toThrow(/Unauthorized/);
  });
  it('uses the socket peer allowlist and normalizes mapped IPv4', () => {
    vi.stubEnv('EVE_AUTH_SECRET', key);
    vi.stubEnv('HARNESS_ALLOWED_IPS', '127.0.0.1,::1');
    const grants = service();
    expect(() => grants.requireService(key, '::ffff:127.0.0.1')).not.toThrow();
    expect(() => grants.requireService(key, '203.0.113.10')).toThrow(/restricted/);
  });
  it('does not throttle an authenticated harness peer inside this process', () => {
    vi.stubEnv('EVE_AUTH_SECRET', key);
    vi.stubEnv('HARNESS_ALLOWED_IPS', '');
    const grants = service();
    for (let i = 0; i < 350; i++)
      expect(() => grants.requireService(key, '127.0.0.1')).not.toThrow();
  });
});

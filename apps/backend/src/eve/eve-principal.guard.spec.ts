import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { signEvePrincipal } from '../utils/eve-principal';
import { PrismaService } from '../prisma/prisma.service';
import { EvePrincipalGuard } from './eve-principal.guard';

beforeAll(() => {
  process.env['BETTER_AUTH_SECRET'] = 'test-secret';
});

/** Build an isolated NestJS testing module with a stubbed PrismaService. */
async function buildGuard(stubMemberFindFirst: ReturnType<typeof vi.fn>) {
  const stubPrisma = {
    member: { findFirst: stubMemberFindFirst },
  };
  const module = await Test.createTestingModule({
    providers: [
      EvePrincipalGuard,
      { provide: PrismaService, useValue: stubPrisma },
    ],
  }).compile();
  return module.get(EvePrincipalGuard);
}

/** Wrap a plain request object in an ExecutionContext stub. */
function makeContext(req: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as never;
}

describe('EvePrincipalGuard — security paths', () => {
  it('passes and attaches {userId,orgId,name,email,image} for valid token + member (happy path)', async () => {
    const token = signEvePrincipal({ userId: 42, orgId: 7 });
    const mockFindFirst = vi.fn().mockResolvedValue({
      id: 1,
      user: { name: 'Alice', email: 'alice@example.com', image: null },
    });
    const guard = await buildGuard(mockFindFirst);

    const req: Record<string, unknown> = {
      headers: { authorization: `EvePrincipal ${token}` },
    };

    const result = await guard.canActivate(makeContext(req));

    expect(result).toBe(true);
    expect(req['evePrincipal']).toEqual({
      userId: 42,
      orgId: 7,
      name: 'Alice',
      email: 'alice@example.com',
      image: null,
    });
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { userId: 42, organizationId: 7 },
      include: { user: { select: { name: true, email: true, image: true } } },
    });
  });

  it('throws ForbiddenException (403) when member.findFirst returns null (non-member)', async () => {
    const token = signEvePrincipal({ userId: 42, orgId: 7 });
    const mockFindFirst = vi.fn().mockResolvedValue(null);
    const guard = await buildGuard(mockFindFirst);

    const req = { headers: { authorization: `EvePrincipal ${token}` } };

    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    // DB must still be queried — the token was valid, the membership is not.
    expect(mockFindFirst).toHaveBeenCalled();
  });

  it('throws UnauthorizedException (401) when Authorization header is absent', async () => {
    const mockFindFirst = vi.fn();
    const guard = await buildGuard(mockFindFirst);

    const req = { headers: {} };

    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    // DB must NOT be reached — fail fast before any DB call.
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException (401) when scheme is Bearer instead of EvePrincipal', async () => {
    const mockFindFirst = vi.fn();
    const guard = await buildGuard(mockFindFirst);

    const req = { headers: { authorization: 'Bearer some-jwt' } };

    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException (401) for a forged token (bad HMAC) — NOT a 500', async () => {
    const mockFindFirst = vi.fn();
    const guard = await buildGuard(mockFindFirst);

    const req = {
      headers: { authorization: 'EvePrincipal attacker.forged_signature' },
    };

    // Must be UnauthorizedException, not an unhandled Error (which would become 500).
    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException (401) for an expired token — TTL genuinely exercised', async () => {
    // Build a VALIDLY-signed token whose iat is > 60 s in the past.
    // Using a real HMAC means verifyEvePrincipal passes the signature check
    // and reaches the `Date.now() - iat > MAX_PRINCIPAL_AGE_MS` branch —
    // the one that was previously unreachable due to the bad-sig shortcut.
    // If that age check were removed, this test would FAIL (token would verify OK).
    const expiredIat = Date.now() - 61_000; // 61 s ago — past the 60 s TTL
    const payloadB64 = Buffer.from(
      JSON.stringify({ userId: 1, orgId: 1, iat: expiredIat }),
    ).toString('base64url');
    const sig = createHmac('sha256', 'test-secret')
      .update(payloadB64)
      .digest('hex');
    const expiredToken = `${payloadB64}.${sig}`;

    const mockFindFirst = vi.fn();
    const guard = await buildGuard(mockFindFirst);

    const req = {
      headers: { authorization: `EvePrincipal ${expiredToken}` },
    };

    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    // DB must NOT be reached — expiry is caught before the membership check.
    expect(mockFindFirst).not.toHaveBeenCalled();
  });
});

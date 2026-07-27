import { describe, it, expect, beforeAll, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { verifyEvePrincipal } from '../utils/eve-principal';

// vi.mock calls are hoisted by vitest before any import runs, so these mocks
// are in effect when EveProxyController and its deps are imported below.
vi.mock('../libs/better-auth/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

import { EveProxyController } from './eve-proxy.controller';
import { EveProxyService } from './eve-proxy.service';
import { EveTargetService } from './eve-target.service';
import { PrismaService } from '../prisma/prisma.service';

beforeAll(() => {
  process.env['BETTER_AUTH_SECRET'] = 'test-secret';
});

/** Build an isolated NestJS testing module with stubbed PrismaService + eve target. */
async function buildController(stubMemberFindFirst: ReturnType<typeof vi.fn>) {
  const stubPrisma = {
    member: { findFirst: stubMemberFindFirst },
  };
  const module = await Test.createTestingModule({
    controllers: [EveProxyController],
    providers: [
      EveProxyService,
      { provide: EveTargetService, useValue: { baseUrl: 'http://eve-stub' } },
      { provide: PrismaService, useValue: stubPrisma },
    ],
  }).compile();
  return module.get(EveProxyController);
}

/** Minimal express Response stub covering everything proxy() touches. */
function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    setHeader: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
    headersSent: false,
  } as unknown as Response;
}

describe('EveProxyController', () => {
  it('401s with no DB lookup when there is no Better Auth session', async () => {
    const mockMemberFindFirst = vi.fn();
    const controller = await buildController(mockMemberFindFirst);

    const { auth } = await import('../libs/better-auth/auth');
    vi.mocked(auth.api.getSession).mockResolvedValue(null);

    const req = {
      headers: { 'x-org-id': '7' },
      method: 'GET',
      originalUrl: '/eve/v1/some/path',
    } as unknown as Request;
    const res = makeRes();

    await controller.proxy(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'unauthenticated' });
    expect(mockMemberFindFirst).not.toHaveBeenCalled();
  });

  it('401s when session user id is non-numeric (NaN guard)', async () => {
    const mockMemberFindFirst = vi.fn();
    const controller = await buildController(mockMemberFindFirst);

    const { auth } = await import('../libs/better-auth/auth');
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'abc' },
    } as never);

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const req = {
      headers: { 'x-org-id': '7' },
      method: 'GET',
      originalUrl: '/eve/v1/some/path',
    } as unknown as Request;
    const res = makeRes();

    try {
      await controller.proxy(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'unauthenticated' });
      expect(mockMemberFindFirst).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('403s when the session user is not a member of the requested org (non-member IDOR)', async () => {
    const mockMemberFindFirst = vi.fn().mockResolvedValue(null);
    const controller = await buildController(mockMemberFindFirst);

    const { auth } = await import('../libs/better-auth/auth');
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: '42' },
    } as never);

    const req = {
      headers: { 'x-org-id': '7' },
      method: 'GET',
      originalUrl: '/eve/v1/some/path',
    } as unknown as Request;
    const res = makeRes();

    await expect(controller.proxy(req, res)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(mockMemberFindFirst).toHaveBeenCalledWith({
      where: { userId: 42, organizationId: 7 },
    });
  });

  it('streams the happy path: upstream fetch carries a valid x-eve-principal and no cookie', async () => {
    const mockMemberFindFirst = vi.fn().mockResolvedValue({ id: 1 });
    const controller = await buildController(mockMemberFindFirst);

    const { auth } = await import('../libs/better-auth/auth');
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: '42' },
    } as never);

    const upstreamHeaders = new Map<string, string>([
      ['content-type', 'application/x-ndjson'],
      ['set-cookie', 'eve-session=upstream-secret; Path=/'],
    ]);
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      headers: {
        forEach: (cb: (value: string, key: string) => void) =>
          upstreamHeaders.forEach((value, key) => cb(value, key)),
      },
      body: null,
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = {
      headers: {
        'x-org-id': '7',
        cookie: 'session=abc',
        authorization: 'Bearer client-token',
        'content-type': 'application/json',
      },
      method: 'GET',
      originalUrl: '/eve/v1/some/path',
      readableDidRead: true,
    } as unknown as Request;
    const res = makeRes();

    try {
      await controller.proxy(req, res);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://eve-stub/eve/v1/some/path');

      const upstreamReqHeaders = init.headers as Record<string, string>;
      expect(upstreamReqHeaders['cookie']).toBeUndefined();
      expect(upstreamReqHeaders['authorization']).toBeUndefined();

      const principal = verifyEvePrincipal(
        upstreamReqHeaders['x-eve-principal'],
      );
      expect(principal).toEqual({ userId: 42, orgId: 7 });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith(
        'content-type',
        'application/x-ndjson',
      );
      expect(res.setHeader).not.toHaveBeenCalledWith(
        'set-cookie',
        expect.anything(),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

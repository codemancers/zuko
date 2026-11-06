import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { getActiveOrganizationId } from './get-organization-id';
import type { PrismaService } from '../../prisma/prisma.service';

type Request = Parameters<typeof getActiveOrganizationId>[0];
function fixture(role: string | null = 'member') {
  const member = {
    findFirst: vi.fn().mockResolvedValue(role ? { role } : null),
    findMany: vi.fn().mockResolvedValue([]),
  };
  const req = {
    headers: {},
    user: { id: '1' },
    session: { user: { id: '1' }, session: { activeOrganizationId: '7' } },
  } as Request;
  return { req, member, prisma: { member } as unknown as PrismaService };
}
describe('active organization membership boundary', () => {
  it('rejects a stale session after membership removal', async () => {
    const { req, prisma } = fixture(null);
    await expect(getActiveOrganizationId(req, prisma)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('does not fall back from an unauthorized explicit header to an authorized session organization', async () => {
    const { req, prisma, member } = fixture();
    req.headers['x-organization-id'] = '8';
    member.findFirst.mockImplementation(async ({ where }) =>
      where.organizationId === 7 ? { role: 'member' } : null,
    );
    await expect(getActiveOrganizationId(req, prisma)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it.each(['owner', 'admin', 'member'])(
    'retains ordinary task access for a current %s',
    async (role) => {
      const { req, prisma, member } = fixture(role);
      expect(await getActiveOrganizationId(req, prisma)).toBe(7);
      expect(member.findFirst).toHaveBeenCalledWith({
        where: { organizationId: 7, userId: 1 },
      });
    },
  );
  it('honors an authorized explicit header', async () => {
    const { req, prisma, member } = fixture();
    req.headers['x-organization-id'] = '8';
    expect(await getActiveOrganizationId(req, prisma)).toBe(8);
    expect(member.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 8, userId: 1 },
    });
  });
  it('retains the single-membership fallback', async () => {
    const { req, prisma, member } = fixture();
    req.session!.session = {};
    member.findMany.mockResolvedValue([{ organizationId: 7 }]);
    expect(await getActiveOrganizationId(req, prisma)).toBe(7);
  });
  it.each([
    { memberships: [] },
    { memberships: [{ organizationId: 7 }, { organizationId: 8 }] },
  ])(
    'requires selection when fallback is ambiguous or empty',
    async ({ memberships }) => {
      const { req, prisma, member } = fixture();
      req.session!.session = {};
      member.findMany.mockResolvedValue(memberships);
      await expect(getActiveOrganizationId(req, prisma)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    },
  );
  it.each(['', '7garbage', '0', '-1', '7.5', '9007199254740992'])(
    'rejects malformed explicit org %j instead of falling back',
    async (id) => {
      const { req, prisma } = fixture();
      req.headers['x-organization-id'] = id;
      await expect(getActiveOrganizationId(req, prisma)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    },
  );
  it.each(['7garbage', '0', '-1', '7.5', '9007199254740992'])(
    'rejects malformed session org %j',
    async (id) => {
      const { req, prisma } = fixture();
      req.session!.session!.activeOrganizationId = id;
      await expect(getActiveOrganizationId(req, prisma)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    },
  );
  it('does not authorize when membership lookup fails', async () => {
    const { req, prisma, member } = fixture();
    member.findFirst.mockRejectedValue(new Error('DB unavailable'));
    await expect(getActiveOrganizationId(req, prisma)).rejects.toThrow(
      'DB unavailable',
    );
  });
});

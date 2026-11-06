import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { SalesOverviewGuard } from './sales-overview.guard';

const request = () => ({
  headers: {},
  session: { user: { id: '1' }, session: { activeOrganizationId: '7' } },
  user: { id: '1', role: 'admin' },
  organizationId: undefined as number | undefined,
});
const context = (req: unknown) =>
  ({ switchToHttp: () => ({ getRequest: () => req }) }) as ExecutionContext;
const setup = (role: string | null) => {
  const member = {
    findFirst: vi.fn(async () => (role === null ? null : { role })),
    findMany: vi.fn(async () => [{ organizationId: 7 }]),
  };
  return {
    member,
    guard: new SalesOverviewGuard({ member } as unknown as PrismaService),
  };
};

describe('SalesOverviewGuard', () => {
  it.each(['admin', 'owner'])('allows organization %s', async (role) => {
    await expect(
      setup(role).guard.canActivate(context(request())),
    ).resolves.toBe(true);
  });
  it.each(['member', 'accountant', '', 'superadmin', null])(
    'denies membership %s despite application admin role',
    async (role) => {
      await expect(
        setup(role).guard.canActivate(context(request())),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );
  it('denies missing authentication even with an attached organization', async () => {
    const { guard, member } = setup('owner');
    await expect(
      guard.canActivate(context({ headers: {}, organizationId: 7 })),
    ).rejects.toThrow();
    expect(member.findFirst).not.toHaveBeenCalled();
  });
  it('checks current membership again after downgrade or removal', async () => {
    const { guard, member } = setup('admin');
    const req = request();
    await expect(guard.canActivate(context(req))).resolves.toBe(true);
    member.findFirst.mockResolvedValue({ role: 'member' });
    await expect(guard.canActivate(context(req))).rejects.toThrow();
    member.findFirst.mockResolvedValue(null);
    await expect(guard.canActivate(context(req))).rejects.toThrow();
  });
  it('re-resolves the active org rather than trusting an old attached organization', async () => {
    const { guard, member } = setup('owner');
    const req = request();
    await guard.canActivate(context(req));
    req.session.session.activeOrganizationId = '8';
    member.findFirst.mockResolvedValue({ role: 'member' });
    await expect(guard.canActivate(context(req))).rejects.toThrow();
    expect(member.findFirst).toHaveBeenLastCalledWith({
      where: { organizationId: 8, userId: 1 },
      select: { role: true },
    });
  });
  it('never falls back to another organization after a forbidden header selection', async () => {
    const { guard, member } = setup('owner');
    member.findFirst.mockResolvedValue(null);
    await expect(
      guard.canActivate(
        context({ ...request(), headers: { 'x-organization-id': '8' } }),
      ),
    ).rejects.toThrow();
  });
  it.each(['7oops', '-7', '0', '1.5', '', ['7'], '9007199254740992'])(
    'denies malformed organization header %s',
    async (value) => {
      await expect(
        setup('owner').guard.canActivate(
          context({ ...request(), headers: { 'x-organization-id': value } }),
        ),
      ).rejects.toThrow();
    },
  );
  it.each(['7oops', '-7', '0', '1.5', '9007199254740992'])(
    'denies malformed active organization %s',
    async (value) => {
      const req = request();
      req.session.session.activeOrganizationId = value;
      await expect(
        setup('owner').guard.canActivate(context(req)),
      ).rejects.toThrow();
    },
  );
  it('allows single-org fallback only with eligible current membership', async () => {
    const req = { ...request(), session: { user: { id: '1' }, session: {} } };
    await expect(setup('owner').guard.canActivate(context(req))).resolves.toBe(
      true,
    );
    await expect(
      setup('member').guard.canActivate(context(req)),
    ).rejects.toThrow();
  });
  it('rejects mismatched authenticated identities', async () => {
    const req = request();
    req.user.id = '2';
    await expect(
      setup('owner').guard.canActivate(context(req)),
    ).rejects.toThrow();
  });
  it('allows organization owner and attaches the resolved organization', async () => {
    const { guard, member } = setup('owner');
    const req = request();
    await expect(guard.canActivate(context(req))).resolves.toBe(true);
    expect(req.organizationId).toBe(7);
    expect(member.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 7, userId: 1 },
      select: { role: true },
    });
  });
});

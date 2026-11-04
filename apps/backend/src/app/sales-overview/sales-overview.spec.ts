import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesOverviewModule } from './sales-overview.module';

describe('Sales Overview access endpoint', () => {
  let app: INestApplication;
  let url: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [SalesOverviewModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        member: {
          findFirst: async ({
            where,
          }: {
            where: { userId: number; organizationId: number };
          }) =>
            where.organizationId === 7 && where.userId <= 3
              ? { role: ['owner', 'admin', 'member'][where.userId - 1] }
              : null,
        },
      })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest();
          const id = req.headers['x-test-user'];
          if (!id) return false;
          req.user = { id, role: 'admin' };
          req.session = {
            user: req.user,
            session: { activeOrganizationId: '7' },
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
  });
  it.each(['1', '2'])(
    'allows org owner/admin %s and returns only the org ID',
    async (user) => {
      const result = await fetch(`${url}/sales-overview/access`, {
        headers: { 'x-test-user': user },
      });
      expect(result.status).toBe(200);
      expect(await result.json()).toEqual({ organizationId: 7 });
      expect(result.headers.get('cache-control')).toContain('no-store');
    },
  );
  it.each(['3', '4'])(
    'rejects Member/nonmember %s despite app admin',
    async (user) => {
      expect(
        (
          await fetch(`${url}/sales-overview/access`, {
            headers: { 'x-test-user': user },
          })
        ).status,
      ).toBe(403);
    },
  );
  it('rejects unauthenticated access', async () => {
    expect((await fetch(`${url}/sales-overview/access`)).status).toBe(403);
  });
  it('rejects foreign organization', async () => {
    expect(
      (
        await fetch(`${url}/sales-overview/access`, {
          headers: { 'x-test-user': '1', 'x-organization-id': '8' },
        })
      ).status,
    ).toBe(403);
  });
});

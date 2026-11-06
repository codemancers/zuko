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
        task: {
          findMany: async () => [
            { id: 12, dueDate: new Date('2026-11-05T00:00:00Z') },
          ],
          count: async () => 1,
        },
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
  it('returns the date-only paginated task query with no-store', async () => {
    const result = await fetch(
      `${url}/sales-overview/needs-attention?date=2026-11-05&page=2&limit=1`,
      {
        headers: { 'x-test-user': '2' },
      },
    );
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toContain('no-store');
    expect(await result.json()).toEqual({
      tasks: [{ id: 12, dueDate: '2026-11-05' }],
      pagination: { page: 2, limit: 1, total: 1, totalPages: 1 },
    });
  });
  it.each([
    '',
    'date=2026-02-30',
    'date=2026-11-05&limit=101',
    'date=2026-11-05&page=0',
    'date=2026-11-05&page=1.5',
    'date=2026-11-05&limit=hello',
  ])('rejects invalid query %s with 400', async (query) => {
    expect(
      (
        await fetch(`${url}/sales-overview/needs-attention?${query}`, {
          headers: { 'x-test-user': '1' },
        })
      ).status,
    ).toBe(400);
  });
  it.each([
    {},
    { 'x-test-user': '3' },
    { 'x-test-user': '4' },
    { 'x-test-user': '1', 'x-organization-id': '8' },
  ])('denies unauthorized task queries %j', async (headers) => {
    expect(
      (
        await fetch(`${url}/sales-overview/needs-attention?date=2026-11-05`, {
          headers: headers as Record<string, string>,
        })
      ).status,
    ).toBe(403);
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

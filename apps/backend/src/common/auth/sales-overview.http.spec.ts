import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  Controller,
  Get,
  Req,
  UseGuards,
  type INestApplication,
  type ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationGuard } from './organization.guard';
import { SalesOverviewGuard } from './sales-overview.guard';

// Test-only endpoints: exercises Nest guard ordering/DI and real HTTP status
// codes without introducing a dashboard route before T07. Authentication and
// storage are controlled fixtures; the authorization guards are real.
@Controller()
class ReviewController {
  @Get('protected')
  @UseGuards(AuthGuard, OrganizationGuard, SalesOverviewGuard)
  protected(@Req() req: { organizationId: number }) {
    return { organizationId: req.organizationId };
  }

  @Get('standalone')
  @UseGuards(AuthGuard, SalesOverviewGuard)
  standalone(@Req() req: { organizationId: number }) {
    return { organizationId: req.organizationId };
  }

  @Get('existing')
  @UseGuards(AuthGuard, OrganizationGuard)
  existing() {
    return { ok: true };
  }
}

describe('Sales Overview authorization HTTP composition', () => {
  let app: INestApplication;
  let url: string;
  const roles = new Map<number, string>();
  beforeEach(() => {
    roles.clear();
    roles.set(7, 'owner');
    roles.set(8, 'member');
  });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReviewController],
      providers: [
        OrganizationGuard,
        SalesOverviewGuard,
        {
          provide: PrismaService,
          useValue: {
            member: {
              findFirst: async ({
                where,
              }: {
                where: { organizationId: number; userId: number };
              }) =>
                where.userId === 1 && roles.has(where.organizationId)
                  ? { role: roles.get(where.organizationId) }
                  : null,
              findMany: async () =>
                [...roles.keys()].map((organizationId) => ({ organizationId })),
            },
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest();
          if (req.headers['x-test-auth'] !== 'yes') return false;
          req.user = { id: '1', role: 'admin' };
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
  const get = (
    path: string,
    headers: Record<string, string> = { 'x-test-auth': 'yes' },
  ) => fetch(`${url}/${path}`, { headers });
  it('allows an owner with both guards composed', async () => {
    const result = await get('protected');
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ organizationId: 7 });
  });
  it('can resolve the organization without a separate OrganizationGuard', async () => {
    expect((await get('standalone')).status).toBe(200);
  });
  it('denies unauthenticated access', async () => {
    expect((await get('protected', {})).status).toBe(403);
  });
  it('denies a switch to member-only organization despite app admin', async () => {
    expect(
      (
        await get('protected', {
          'x-test-auth': 'yes',
          'x-organization-id': '8',
        })
      ).status,
    ).toBe(403);
  });
  it('rejects nonmember header selection instead of serving fallback org', async () => {
    expect(
      (
        await get('protected', {
          'x-test-auth': 'yes',
          'x-organization-id': '9',
        })
      ).status,
    ).toBe(403);
  });
  it('reflects role downgrades and removal on subsequent requests', async () => {
    expect((await get('protected')).status).toBe(200);
    roles.set(7, 'member');
    expect((await get('protected')).status).toBe(403);
    roles.delete(7);
    expect((await get('protected')).status).toBe(403);
  });
  it('does not restrict existing endpoints for Members', async () => {
    roles.set(7, 'member');
    expect((await get('existing')).status).toBe(200);
    expect((await get('protected')).status).toBe(403);
  });
});

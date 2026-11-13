import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Body, Controller, Get, Inject, Patch } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { AppModule } from '../src/app/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { createAuth } from '../src/libs/better-auth/auth';
import { CurrentOrganization, RequireOrganization } from '../src/organizations/organization-access';
import type { OrganizationContext } from '../src/organizations/organization-access';

// Test-only resource: prove repository reads/writes use verified tenancy without
// adding a duplicate organisation CRUD API to production.
@Controller('organizations/:organizationId/probe')
class WriteProbeController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @RequireOrganization()
  read(@CurrentOrganization() context: OrganizationContext) {
    return this.prisma.organization.findUniqueOrThrow({
      where: { id: BigInt(context.organizationId) },
      select: { name: true },
    });
  }

  @Patch()
  @RequireOrganization({ organization: ['update'] })
  write(@CurrentOrganization() context: OrganizationContext, @Body() body: { name: string }) {
    return this.prisma.organization.update({
      where: { id: BigInt(context.organizationId) },
      data: { name: body.name },
      select: { name: true },
    });
  }

  @Get('missing-policy')
  missingPolicy() {
    return { leaked: true };
  }
}

let app: INestApplication;
let prisma: PrismaService;
let base: string;
let cookie: string;
let userId: bigint;
let organizationId: bigint;
let otherOrganizationId: bigint;
const email = `${randomUUID()}@example.test`;
const password = randomBytes(24).toString('hex');
let auth: ReturnType<typeof createAuth>;

beforeAll(async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_test')) {
    throw new Error('Set TEST_DATABASE_URL to a dedicated database ending in _test');
  }
  process.env.DATABASE_URL = databaseUrl;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('hex');
  const module = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [WriteProbeController],
  }).compile();
  app = module.createNestApplication({ bodyParser: false });
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');
  base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  prisma = app.get(PrismaService);
  auth = app.get<AuthService<ReturnType<typeof createAuth>>>(AuthService).instance;
  const response = await auth.api.signUpEmail({
    body: { name: 'Access test', email, password },
    asResponse: true,
  });
  assert.equal(response.status, 200, 'Fixture signup failed');
  const signup = (await response.json()) as { user: { id: string } };
  userId = BigInt(signup.user.id);
  cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  organizationId = (
    await prisma.organization.create({
      data: { name: 'Access test', slug: randomUUID(), createdAt: new Date() },
    })
  ).id;
  otherOrganizationId = (
    await prisma.organization.create({
      data: {
        name: 'Other tenant',
        slug: randomUUID(),
        createdAt: new Date(),
      },
    })
  ).id;
  await prisma.member.create({
    data: { organizationId, userId, role: 'member', createdAt: new Date() },
  });
  await prisma.session.updateMany({
    where: { userId },
    data: { activeOrganizationId: organizationId },
  });
});

beforeEach(async () => {
  await prisma.member.deleteMany({
    where: { userId, organizationId: { in: [organizationId, otherOrganizationId] } },
  });
  await prisma.member.create({
    data: { organizationId, userId, role: 'member', createdAt: new Date() },
  });
  await prisma.session.deleteMany({ where: { userId } });
  const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  assert.equal(response.status, 200, 'Fixture login failed');
  cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  await prisma.session.updateMany({
    where: { userId },
    data: { activeOrganizationId: organizationId },
  });
  await prisma.organization.update({
    where: { id: organizationId },
    data: { name: 'Access test' },
  });
});

afterAll(async () => {
  if (prisma) {
    await prisma.organization.deleteMany({
      where: { id: { in: [organizationId, otherOrganizationId] } },
    });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  }
  await app?.close();
});

it('returns only the current, verified organisation membership', async () => {
  const response = await fetch(`${base}/api/organizations/${organizationId}/access`, {
    headers: { cookie },
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    organizationId: String(organizationId),
    userId: String(userId),
    role: 'member',
  });
});

function access(id = organizationId, headers: Record<string, string> = { cookie }) {
  return fetch(`${base}/api/organizations/${id}/access`, { headers });
}

function write(
  id = organizationId,
  body: Record<string, unknown> = { name: 'Changed' },
  headers: Record<string, string> = { cookie },
) {
  return fetch(`${base}/api/organizations/${id}/probe`, {
    method: 'PATCH',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(body, (_key, value) =>
      typeof value === 'bigint' ? String(value) : value,
    ),
  });
}

it('rejects cookie-authenticated writes from an untrusted browser origin', async () => {
  await prisma.member.updateMany({ where: { userId }, data: { role: 'owner' } });
  for (const origin of [
    'https://attacker.example',
    'null',
    'http://localhost:4200.attacker.example',
  ]) {
    expect((await write(organizationId, { name: 'Forbidden' }, { cookie, origin })).status).toBe(
      403,
    );
  }
  expect(
    (await write(organizationId, { name: 'Forbidden' }, { cookie, 'sec-fetch-site': 'cross-site' }))
      .status,
  ).toBe(403);
  expect(
    (await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })).name,
  ).toBe('Access test');
  const origin = new URL((await auth.$context).baseURL).origin;
  expect((await write(organizationId, { name: 'Allowed' }, { cookie, origin })).status).toBe(200);
});

it('rejects unauthenticated reads and writes', async () => {
  expect((await access(organizationId, {})).status).toBe(401);
  expect((await write(organizationId, { name: 'Changed' }, {})).status).toBe(401);
});

it('rejects forged session cookies', async () => {
  expect(
    (await access(organizationId, { cookie: 'better-auth.session_token=forged' })).status,
  ).toBe(401);
});

it('rejects expired sessions', async () => {
  await prisma.session.updateMany({ where: { userId }, data: { expiresAt: new Date(0) } });
  expect((await access()).status).toBe(401);
});

it('rejects a previously valid session after revocation', async () => {
  expect((await access()).status).toBe(200);
  await prisma.session.deleteMany({ where: { userId } });
  expect((await access()).status).toBe(401);
  expect((await write()).status).toBe(401);
});

it('rejects another tenant for reads and writes without modifying either tenant', async () => {
  await prisma.member.updateMany({ where: { userId }, data: { role: 'owner' } });
  expect((await access(otherOrganizationId)).status).toBe(403);
  expect((await write(otherOrganizationId)).status).toBe(403);
  expect(
    (await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })).name,
  ).toBe('Access test');
  expect(
    (await prisma.organization.findUniqueOrThrow({ where: { id: otherOrganizationId } })).name,
  ).toBe('Other tenant');
});

it('rejects a stale active organisation after membership is revoked', async () => {
  expect((await access()).status).toBe(200);
  await prisma.member.deleteMany({ where: { userId, organizationId } });
  expect((await access()).status).toBe(403);
  expect((await write()).status).toBe(403);
});

it('does not trust an active organisation without membership', async () => {
  await prisma.session.updateMany({
    where: { userId },
    data: { activeOrganizationId: otherOrganizationId },
  });
  expect((await access(otherOrganizationId)).status).toBe(403);
});

it('requires an explicitly selected active organisation; no first-membership fallback', async () => {
  await prisma.session.updateMany({ where: { userId }, data: { activeOrganizationId: null } });
  expect((await access()).status).toBe(403);
});

it('persists an authorised write, then rejects it immediately after demotion', async () => {
  await prisma.member.updateMany({ where: { userId }, data: { role: 'admin' } });
  expect((await write()).status).toBe(200);
  expect(
    (await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })).name,
  ).toBe('Changed');
  const reload = await fetch(`${base}/api/organizations/${organizationId}/probe`, {
    headers: { cookie },
  });
  expect(await reload.json()).toEqual({ name: 'Changed' });
  await prisma.member.updateMany({ where: { userId }, data: { role: 'member' } });
  expect((await write(organizationId, { name: 'Forbidden' })).status).toBe(403);
  expect(
    (await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })).name,
  ).toBe('Changed');
});

it('does not infer ownership from user IDs or body role claims', async () => {
  expect(
    (
      await write(organizationId, {
        name: 'Forbidden',
        role: 'owner',
        ownerId: userId,
        assigneeId: userId,
      })
    ).status,
  ).toBe(403);
});

it('rejects unsupported roles instead of granting member access', async () => {
  await prisma.member.updateMany({ where: { userId }, data: { role: 'superadmin' } });
  expect((await access()).status).toBe(403);
});

it('rejects conflicting body, query and header organisation selectors', async () => {
  await prisma.member.updateMany({ where: { userId }, data: { role: 'owner' } });
  expect(
    (await write(organizationId, { name: 'Forbidden', organizationId: otherOrganizationId }))
      .status,
  ).toBe(403);
  expect(
    (await access(organizationId, { cookie, 'x-organization-id': String(otherOrganizationId) }))
      .status,
  ).toBe(403);
  expect(
    (
      await fetch(
        `${base}/api/organizations/${organizationId}/access?organizationId=${otherOrganizationId}`,
        { headers: { cookie } },
      )
    ).status,
  ).toBe(403);
  expect(
    (await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })).name,
  ).toBe('Access test');
});

it('fails closed when a future API forgets to declare its policy', async () => {
  const response = await fetch(`${base}/api/organizations/${organizationId}/probe/missing-policy`, {
    headers: { cookie },
  });
  expect(response.status).toBe(403);
});

it('revalidates membership on a legitimate organisation switch', async () => {
  await prisma.member.create({
    data: {
      organizationId: otherOrganizationId,
      userId,
      role: 'member',
      createdAt: new Date(),
    },
  });
  const response = await fetch(`${base}/auth/organization/set-active`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ organizationId: String(otherOrganizationId) }),
  });
  expect(response.status).toBe(200);
  expect((await access(otherOrganizationId)).status).toBe(200);
  expect((await access()).status).toBe(403);
});

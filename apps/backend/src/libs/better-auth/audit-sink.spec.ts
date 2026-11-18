import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import type { AuditEventInput } from '@zuko/better-auth-audit';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../../generated/prisma/client';
import { runInTenant } from '../../prisma/tenant-transaction';
import { auditSink } from './audit-sink';

config({ path: resolve(__dirname, '../../../../../.env'), quiet: true });

const url = process.env.TEST_DATABASE_URL;

// Real-database test; see src/prisma/core-data-model.spec.ts for how to set TEST_DATABASE_URL.
describe.skipIf(!url)('audit sink', () => {
  const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : (undefined as never);
  const suffix = Math.random().toString(36).slice(2, 8);
  let orgA: bigint;
  let orgB: bigint;
  let actor: bigint;

  const event = (overrides: Partial<AuditEventInput> = {}): AuditEventInput => ({
    organizationId: String(orgA),
    actorType: 'USER',
    actorId: String(actor),
    event: 'member.invited',
    targetType: 'invitation',
    targetId: '42',
    metadata: { email: 'new@example.com', role: 'member' },
    ip: '203.0.113.9',
    userAgent: 'vitest',
    requestId: 'req-1',
    ...overrides,
  });

  beforeAll(async () => {
    await prisma.$connect();
    orgA = (await prisma.organization.create({ data: { name: 'A', slug: `sa-${suffix}` } })).id;
    orgB = (await prisma.organization.create({ data: { name: 'B', slug: `sb-${suffix}` } })).id;
    actor = (await prisma.user.create({ data: { name: 'actor', email: `actor-${suffix}@example.com` } })).id;
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.audit_purge', 'on', true)`;
      await tx.auditEvent.deleteMany({ where: { OR: [{ organizationId: { in: [orgA, orgB] } }, { actorId: actor }] } });
      await tx.auditEvent.deleteMany({ where: { event: { startsWith: 'sink-test.' } } });
    });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.user.deleteMany({ where: { id: actor } });
    await prisma.$disconnect();
  });

  it('stores an organization event with every field, visible to that tenant only', async () => {
    await auditSink(prisma)(event(), { adapter: undefined as never });

    const rows = await runInTenant(prisma, { organizationId: orgA }, (tx) => tx.auditEvent.findMany());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      organizationId: orgA,
      actorType: 'USER',
      actorId: actor,
      event: 'member.invited',
      targetType: 'invitation',
      targetId: 42n,
      metadata: { email: 'new@example.com', role: 'member' },
      ip: '203.0.113.9',
      userAgent: 'vitest',
      requestId: 'req-1',
    });
    expect(await runInTenant(prisma, { organizationId: orgB }, (tx) => tx.auditEvent.count())).toBe(0);
  });

  it('stores an organization-less event that no tenant can read', async () => {
    await auditSink(prisma)(
      event({ organizationId: null, actorType: 'ANONYMOUS', actorId: null, event: 'sink-test.sign_in_failed', targetType: null, targetId: null }),
      { adapter: undefined as never },
    );

    expect(await prisma.auditEvent.count({ where: { event: 'sink-test.sign_in_failed' } })).toBe(1);
    expect(
      await runInTenant(prisma, { organizationId: orgA }, (tx) =>
        tx.auditEvent.count({ where: { event: 'sink-test.sign_in_failed' } }),
      ),
    ).toBe(0);
  });
});

import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../generated/prisma/client';
import { runInTenant } from './tenant-transaction';

config({ path: resolve(__dirname, '../../../../.env'), quiet: true });

const url = process.env.TEST_DATABASE_URL;
const RLS = /row-level security/i;
const DENIED = /permission denied/i;
const APPEND_ONLY = /append-only/i;
const CHECK = /check constraint/i;

// Real-database test; see core-data-model.spec.ts for how to set TEST_DATABASE_URL.
describe.skipIf(!url)('audit tables', () => {
  const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : (undefined as never);
  const suffix = Math.random().toString(36).slice(2, 8);
  let orgA: bigint;
  let orgB: bigint;

  const change = (org: bigint, overrides: Record<string, unknown> = {}) => ({
    organizationId: org,
    recordId: 1n,
    objectTypeId: 1n,
    action: 'UPDATE',
    changes: { stage: { old: 'open', new: 'closed_won' } },
    actorType: 'USER',
    actorId: 7n,
    requestId: 'req-1',
    ...overrides,
  });
  const logChange = (org: bigint, overrides?: Record<string, unknown>) =>
    runInTenant(prisma, { organizationId: org }, (tx) => tx.recordChange.create({ data: change(org, overrides) }));
  const event = (org: bigint | null, overrides: Record<string, unknown> = {}) => ({
    organizationId: org,
    actorType: 'USER',
    event: 'member.invited',
    ...overrides,
  });

  // Audit rows can only be removed with the purge flag set, as a retention job would.
  const purge = (org: bigint) =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.audit_purge', 'on', true)`;
      await tx.recordChange.deleteMany({ where: { organizationId: org } });
      await tx.auditEvent.deleteMany({ where: { OR: [{ organizationId: org }, { organizationId: null }] } });
    });

  beforeAll(async () => {
    await prisma.$connect();
    orgA = (await prisma.organization.create({ data: { name: 'A', slug: `aa-${suffix}` } })).id;
    orgB = (await prisma.organization.create({ data: { name: 'B', slug: `ab-${suffix}` } })).id;
  });

  afterAll(async () => {
    await purge(orgA);
    await purge(orgB);
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.$disconnect();
  });

  describe('record_change', () => {
    it('is private to its tenant', async () => {
      await logChange(orgA);
      expect(await runInTenant(prisma, { organizationId: orgA }, (tx) => tx.recordChange.count())).toBe(1);
      expect(await runInTenant(prisma, { organizationId: orgB }, (tx) => tx.recordChange.count())).toBe(0);
    });

    it('cannot be written for another tenant', async () => {
      await expect(
        runInTenant(prisma, { organizationId: orgA }, (tx) => tx.recordChange.create({ data: change(orgB) })),
      ).rejects.toThrow(RLS);
    });

    it('rejects unknown actions and actor types', async () => {
      await expect(logChange(orgA, { action: 'TOUCH' })).rejects.toThrow(CHECK);
      await expect(logChange(orgA, { actorType: 'ROBOT' })).rejects.toThrow(CHECK);
      await expect(logChange(orgA, { actorType: 'ANONYMOUS' })).rejects.toThrow(CHECK);
    });

    it('cannot be updated or deleted by the app role', async () => {
      await expect(
        runInTenant(prisma, { organizationId: orgA }, (tx) => tx.recordChange.updateMany({ data: { action: 'DELETE' } })),
      ).rejects.toThrow(DENIED);
      await expect(
        runInTenant(prisma, { organizationId: orgA }, (tx) => tx.recordChange.deleteMany()),
      ).rejects.toThrow(DENIED);
    });

    it('cannot be updated or deleted by the login role either', async () => {
      await expect(prisma.recordChange.updateMany({ data: { action: 'DELETE' } })).rejects.toThrow(APPEND_ONLY);
      await expect(prisma.recordChange.deleteMany({ where: { organizationId: orgA } })).rejects.toThrow(APPEND_ONLY);
    });

    it('survives the record it describes, with no foreign key to it', async () => {
      const objectType = await runInTenant(prisma, { organizationId: orgA }, (tx) =>
        tx.objectType.create({
          data: { organizationId: orgA, slug: 'deal', label: 'Deal', pluralLabel: 'Deals', kind: 'STANDARD' },
        }),
      );
      const record = await runInTenant(prisma, { organizationId: orgA }, (tx) =>
        tx.objectRecord.create({ data: { organizationId: orgA, objectTypeId: objectType.id, properties: {} } }),
      );
      await logChange(orgA, { recordId: record.id, objectTypeId: objectType.id, action: 'CREATE' });

      await runInTenant(prisma, { organizationId: orgA }, (tx) => tx.objectRecord.delete({ where: { id: record.id } }));

      const rows = await runInTenant(prisma, { organizationId: orgA }, (tx) =>
        tx.recordChange.findMany({ where: { recordId: record.id } }),
      );
      expect(rows).toHaveLength(1);
    });
  });

  describe('audit_event', () => {
    it('lets a tenant read only its own events', async () => {
      await runInTenant(prisma, { organizationId: orgA }, (tx) => tx.auditEvent.create({ data: event(orgA) }));
      expect(await runInTenant(prisma, { organizationId: orgA }, (tx) => tx.auditEvent.count())).toBe(1);
      expect(await runInTenant(prisma, { organizationId: orgB }, (tx) => tx.auditEvent.count())).toBe(0);
    });

    it('accepts org-less events but never shows them to a tenant', async () => {
      await prisma.auditEvent.create({
        data: event(null, { actorType: 'ANONYMOUS', event: 'sign_in.failed' }),
      });
      // Inside a tenant context use createMany: create() adds RETURNING, which must also
      // pass the read policy, and an org-less row never does.
      await runInTenant(prisma, { organizationId: orgA }, (tx) => tx.auditEvent.createMany({ data: [event(null)] }));
      await expect(
        runInTenant(prisma, { organizationId: orgA }, (tx) => tx.auditEvent.create({ data: event(null) })),
      ).rejects.toThrow(RLS);

      expect(
        await runInTenant(prisma, { organizationId: orgA }, (tx) => tx.auditEvent.count({ where: { organizationId: null } })),
      ).toBe(0);
      expect(await prisma.auditEvent.count({ where: { organizationId: null } })).toBe(2);
    });

    it('cannot be written for another tenant', async () => {
      await expect(
        runInTenant(prisma, { organizationId: orgA }, (tx) => tx.auditEvent.create({ data: event(orgB) })),
      ).rejects.toThrow(RLS);
    });

    it('rejects unknown actor types', async () => {
      await expect(prisma.auditEvent.create({ data: event(orgA, { actorType: 'ROBOT' }) })).rejects.toThrow(CHECK);
    });

    it('is append-only for both roles', async () => {
      await expect(
        runInTenant(prisma, { organizationId: orgA }, (tx) => tx.auditEvent.updateMany({ data: { event: 'x' } })),
      ).rejects.toThrow(DENIED);
      await expect(prisma.auditEvent.updateMany({ data: { event: 'x' } })).rejects.toThrow(APPEND_ONLY);
      await expect(prisma.auditEvent.deleteMany({ where: { organizationId: orgA } })).rejects.toThrow(APPEND_ONLY);
    });
  });

  it('allows deletion only through the purge flag', async () => {
    await logChange(orgB);
    await purge(orgB);
    expect(await prisma.recordChange.count({ where: { organizationId: orgB } })).toBe(0);
  });
});

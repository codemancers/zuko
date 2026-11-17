import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../generated/prisma/client';
import { runInTenant } from './tenant-transaction';

config({ path: resolve(__dirname, '../../../../.env'), quiet: true });

const url = process.env.TEST_DATABASE_URL;
const UNIQUE = /unique constraint/i;
const CHECK = /check constraint/i;
const FK = /foreign key constraint/i;

// Real-database test; see core-data-model.spec.ts for how to set TEST_DATABASE_URL.
describe.skipIf(!url)('record access', () => {
  const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : (undefined as never);
  const suffix = Math.random().toString(36).slice(2, 8);
  let orgA: bigint;
  let orgB: bigint;
  let memberA: bigint; // member of org A
  let outsider: bigint; // member of org B only
  let teamA: bigint;
  let teamB: bigint;
  let typeA: bigint;
  let typeB: bigint;
  let recordA: bigint;

  const inA = <T>(fn: Parameters<typeof runInTenant<T>>[2]) => runInTenant(prisma, { organizationId: orgA }, fn);
  const inB = <T>(fn: Parameters<typeof runInTenant<T>>[2]) => runInTenant(prisma, { organizationId: orgB }, fn);

  const access = (overrides: Record<string, unknown> = {}) => ({
    organizationId: orgA,
    role: 'member',
    objectTypeId: null,
    readScope: 'OWN_AND_REPORTS',
    writeScope: 'OWN',
    ...overrides,
  });
  const share = (overrides: Record<string, unknown> = {}) => ({
    organizationId: orgA,
    recordId: recordA,
    userId: memberA,
    access: 'READ',
    ...overrides,
  });

  beforeAll(async () => {
    await prisma.$connect();
    const user = (name: string) => prisma.user.create({ data: { name, email: `${name}-${suffix}@example.com` } });
    orgA = (await prisma.organization.create({ data: { name: 'A', slug: `xa-${suffix}` } })).id;
    orgB = (await prisma.organization.create({ data: { name: 'B', slug: `xb-${suffix}` } })).id;
    memberA = (await user('member-a')).id;
    outsider = (await user('outsider')).id;
    await prisma.member.create({ data: { organizationId: orgA, userId: memberA, role: 'member' } });
    await prisma.member.create({ data: { organizationId: orgB, userId: outsider, role: 'member' } });
    teamA = (await prisma.team.create({ data: { name: 'Sales', organizationId: orgA } })).id;
    teamB = (await prisma.team.create({ data: { name: 'Sales', organizationId: orgB } })).id;
    const type = (org: bigint) => ({
      data: { organizationId: org, slug: 'deal', label: 'Deal', pluralLabel: 'Deals', kind: 'STANDARD' },
    });
    typeA = (await inA((tx) => tx.objectType.create(type(orgA)))).id;
    typeB = (await inB((tx) => tx.objectType.create(type(orgB)))).id;
    recordA = (
      await inA((tx) =>
        tx.objectRecord.create({ data: { organizationId: orgA, objectTypeId: typeA, properties: {} } }),
      )
    ).id;
  });

  afterAll(async () => {
    await prisma.objectRecord.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [memberA, outsider] } } });
    await prisma.$disconnect();
  });

  describe('role_object_access', () => {
    it('stores a default and a per-object override for a role', async () => {
      await inA((tx) => tx.roleObjectAccess.create({ data: access() }));
      await inA((tx) => tx.roleObjectAccess.create({ data: access({ objectTypeId: typeA, readScope: 'ALL' }) }));
      expect(await inA((tx) => tx.roleObjectAccess.count())).toBe(2);
    });

    it('allows one default and one override per role, no more', async () => {
      await expect(inA((tx) => tx.roleObjectAccess.create({ data: access() }))).rejects.toThrow(UNIQUE);
      await expect(
        inA((tx) => tx.roleObjectAccess.create({ data: access({ objectTypeId: typeA }) })),
      ).rejects.toThrow(UNIQUE);
      // Another role is unaffected.
      await inA((tx) => tx.roleObjectAccess.create({ data: access({ role: 'admin' }) }));
    });

    it('is private to its tenant', async () => {
      expect(await inB((tx) => tx.roleObjectAccess.count())).toBe(0);
      await expect(inA((tx) => tx.roleObjectAccess.create({ data: access({ organizationId: orgB }) }))).rejects.toThrow(
        /row-level security/i,
      );
    });

    it('rejects unknown scopes', async () => {
      await expect(
        inA((tx) => tx.roleObjectAccess.create({ data: access({ role: 'viewer', readScope: 'EVERYONE' }) })),
      ).rejects.toThrow(CHECK);
      await expect(
        inA((tx) => tx.roleObjectAccess.create({ data: access({ role: 'viewer', writeScope: 'NONE' }) })),
      ).rejects.toThrow(CHECK);
    });

    it("rejects another organization's object type", async () => {
      await expect(
        inA((tx) => tx.roleObjectAccess.create({ data: access({ role: 'viewer', objectTypeId: typeB }) })),
      ).rejects.toThrow(FK);
    });

    it('is removed with its object type', async () => {
      const type = await inA((tx) =>
        tx.objectType.create({
          data: { organizationId: orgA, slug: 'temp', label: 'Temp', pluralLabel: 'Temps', kind: 'CUSTOM' },
        }),
      );
      await inA((tx) => tx.roleObjectAccess.create({ data: access({ role: 'temp-role', objectTypeId: type.id }) }));
      await inA((tx) => tx.objectType.delete({ where: { id: type.id } }));
      expect(await inA((tx) => tx.roleObjectAccess.count({ where: { role: 'temp-role' } }))).toBe(0);
    });
  });

  describe('record_share', () => {
    it('shares a record with a member and with a team', async () => {
      await inA((tx) => tx.recordShare.create({ data: share() }));
      await inA((tx) => tx.recordShare.create({ data: share({ userId: null, teamId: teamA, access: 'WRITE' }) }));
      expect(await inA((tx) => tx.recordShare.count())).toBe(2);
    });

    it('needs exactly one target and a valid access level', async () => {
      await expect(
        inA((tx) => tx.recordShare.create({ data: share({ teamId: teamA }) })),
      ).rejects.toThrow(CHECK);
      await expect(
        inA((tx) => tx.recordShare.create({ data: share({ userId: null, teamId: null }) })),
      ).rejects.toThrow(CHECK);
      await expect(inA((tx) => tx.recordShare.create({ data: share({ access: 'OWNER' }) }))).rejects.toThrow(CHECK);
    });

    it('rejects a user who is not a member and a team from another organization', async () => {
      await expect(inA((tx) => tx.recordShare.create({ data: share({ userId: outsider }) }))).rejects.toThrow(FK);
      await expect(
        inA((tx) => tx.recordShare.create({ data: share({ userId: null, teamId: teamB }) })),
      ).rejects.toThrow(FK);
    });

    it('shares a record with the same target only once', async () => {
      await expect(inA((tx) => tx.recordShare.create({ data: share() }))).rejects.toThrow(UNIQUE);
      await expect(
        inA((tx) => tx.recordShare.create({ data: share({ userId: null, teamId: teamA }) })),
      ).rejects.toThrow(UNIQUE);
    });

    it('is private to its tenant and cannot point at another tenant\'s record', async () => {
      expect(await inB((tx) => tx.recordShare.count())).toBe(0);
      await expect(
        inB((tx) => tx.recordShare.create({ data: share({ organizationId: orgB, userId: outsider }) })),
      ).rejects.toThrow(FK);
    });

    it('is removed with its record', async () => {
      const rec = await inA((tx) =>
        tx.objectRecord.create({ data: { organizationId: orgA, objectTypeId: typeA, properties: {} } }),
      );
      await inA((tx) => tx.recordShare.create({ data: share({ recordId: rec.id }) }));
      await inA((tx) => tx.objectRecord.delete({ where: { id: rec.id } }));
      expect(await inA((tx) => tx.recordShare.count({ where: { recordId: rec.id } }))).toBe(0);
    });
  });
});

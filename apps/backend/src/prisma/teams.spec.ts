import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../generated/prisma/client';
import { runInTenant } from './tenant-transaction';

config({ path: resolve(__dirname, '../../../../.env'), quiet: true });

const url = process.env.TEST_DATABASE_URL;
// The trigger raises a foreign_key_violation; Prisma reports it without our message.
const NOT_IN_ORG = /foreign key constraint/i;

// Real-database test; see core-data-model.spec.ts for how to set TEST_DATABASE_URL.
describe.skipIf(!url)('record teams', () => {
  const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : (undefined as never);
  const suffix = Math.random().toString(36).slice(2, 8);
  let orgA: bigint;
  let orgB: bigint;
  let typeA: bigint;
  let teamA: bigint;
  let teamB: bigint;

  const createRecord = (teamId: bigint | null) =>
    runInTenant(prisma, { organizationId: orgA }, (tx) =>
      tx.objectRecord.create({
        data: { organizationId: orgA, objectTypeId: typeA, properties: {}, teamId },
      }),
    );

  beforeAll(async () => {
    await prisma.$connect();
    orgA = (await prisma.organization.create({ data: { name: 'A', slug: `ta-${suffix}` } })).id;
    orgB = (await prisma.organization.create({ data: { name: 'B', slug: `tb-${suffix}` } })).id;
    teamA = (await prisma.team.create({ data: { name: 'Sales', organizationId: orgA } })).id;
    teamB = (await prisma.team.create({ data: { name: 'Sales', organizationId: orgB } })).id;
    typeA = (
      await runInTenant(prisma, { organizationId: orgA }, (tx) =>
        tx.objectType.create({
          data: { organizationId: orgA, slug: 'deal', label: 'Deal', pluralLabel: 'Deals', kind: 'STANDARD' },
        }),
      )
    ).id;
  });

  afterAll(async () => {
    await prisma.objectRecord.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.$disconnect();
  });

  it('lets a record belong to a team of its own organization', async () => {
    const rec = await createRecord(teamA);
    expect(rec.teamId).toBe(teamA);
  });

  it('rejects a team from another organization, on insert and update', async () => {
    await expect(createRecord(teamB)).rejects.toThrow(NOT_IN_ORG);

    const rec = await createRecord(null);
    await expect(
      runInTenant(prisma, { organizationId: orgA }, (tx) =>
        tx.objectRecord.update({ where: { id: rec.id }, data: { teamId: teamB } }),
      ),
    ).rejects.toThrow(NOT_IN_ORG);
  });

  it('clears the team link, keeping the record, when the team is deleted', async () => {
    const team = await prisma.team.create({ data: { name: 'Temp', organizationId: orgA } });
    const rec = await createRecord(team.id);

    await prisma.team.delete({ where: { id: team.id } });

    const after = await runInTenant(prisma, { organizationId: orgA }, (tx) =>
      tx.objectRecord.findUniqueOrThrow({ where: { id: rec.id } }),
    );
    expect(after.teamId).toBeNull();
  });
});

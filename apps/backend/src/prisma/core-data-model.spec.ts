import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../generated/prisma/client';
import { runInTenant, type TenantTransaction } from './tenant-transaction';

config({ path: resolve(__dirname, '../../../../.env'), quiet: true });

const RLS = /row-level security/;
const FK = /foreign key/i;
const CHECK = /check constraint/i;

// Real-database test. Needs TEST_DATABASE_URL pointing at a database built from the
// migration files (`prisma migrate deploy`), because the dev database may predate
// the integer-ids change.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('core data model', () => {
  const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : (undefined as never);
  const suffix = Math.random().toString(36).slice(2, 8);
  let orgA: bigint;
  let orgB: bigint;
  let contactA: bigint; // object type in org A
  let contactB: bigint; // object type in org B

  const as = <T>(org: bigint, fn: (tx: TenantTransaction) => Promise<T>) =>
    runInTenant(prisma, { organizationId: org }, fn);

  const createObjectType = (org: bigint, slug: string, kind = 'STANDARD') =>
    as(org, (tx) =>
      tx.objectType.create({
        data: { organizationId: org, slug, label: slug, pluralLabel: `${slug}s`, kind },
      }),
    );

  beforeAll(async () => {
    await prisma.$connect();
    orgA = (await prisma.organization.create({ data: { name: 'A', slug: `a-${suffix}` } })).id;
    orgB = (await prisma.organization.create({ data: { name: 'B', slug: `b-${suffix}` } })).id;
    contactA = (await createObjectType(orgA, 'contact')).id;
    contactB = (await createObjectType(orgB, 'contact')).id;
  });

  afterAll(async () => {
    await prisma.objectRecord.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.$disconnect();
  });

  it('isolates object types per tenant, including identical slugs', async () => {
    expect(await as(orgA, (tx) => tx.objectType.findMany())).toHaveLength(1);
    expect(await as(orgB, (tx) => tx.objectType.findMany())).toHaveLength(1);
    await expect(createObjectType(orgA, 'contact')).rejects.toThrow(/unique/i);
  });

  it('cannot create rows for another organization', async () => {
    await expect(
      as(orgA, (tx) =>
        tx.objectType.create({
          data: { organizationId: orgB, slug: 'x', label: 'x', pluralLabel: 'xs', kind: 'CUSTOM' },
        }),
      ),
    ).rejects.toThrow(RLS);
  });

  it('stores records and keeps them private to their tenant', async () => {
    const rec = await as(orgA, (tx) =>
      tx.objectRecord.create({
        data: { organizationId: orgA, objectTypeId: contactA, properties: { email: 'a@x.com' } },
      }),
    );
    expect(await as(orgA, (tx) => tx.objectRecord.findUnique({ where: { id: rec.id } }))).not.toBeNull();
    expect(await as(orgB, (tx) => tx.objectRecord.findUnique({ where: { id: rec.id } }))).toBeNull();
    expect(await as(orgB, (tx) => tx.objectRecord.count())).toBe(0);
  });

  it('rejects a record that points at another tenant\'s object type', async () => {
    await expect(
      as(orgA, (tx) =>
        tx.objectRecord.create({ data: { organizationId: orgA, objectTypeId: contactB, properties: {} } }),
      ),
    ).rejects.toThrow(FK);
  });

  it('rejects a field on another tenant\'s object type', async () => {
    await expect(
      as(orgA, (tx) =>
        tx.fieldDefinition.create({
          data: { organizationId: orgA, objectTypeId: contactB, name: 'email', label: 'Email', type: 'EMAIL' },
        }),
      ),
    ).rejects.toThrow(FK);
  });

  it('enforces unique field names per object type and valid names', async () => {
    const data = { organizationId: orgA, objectTypeId: contactA, label: 'City', type: 'TEXT' };
    await as(orgA, (tx) => tx.fieldDefinition.create({ data: { ...data, name: 'city' } }));
    await expect(
      as(orgA, (tx) => tx.fieldDefinition.create({ data: { ...data, name: 'city' } })),
    ).rejects.toThrow(/unique/i);
    await expect(
      as(orgA, (tx) => tx.fieldDefinition.create({ data: { ...data, name: 'Bad Name' } })),
    ).rejects.toThrow(CHECK);
  });

  it('rejects unknown object kinds and cardinalities', async () => {
    await expect(createObjectType(orgA, 'weird', 'OTHER')).rejects.toThrow(CHECK);
    await expect(
      as(orgA, (tx) =>
        tx.associationDefinition.create({
          data: {
            organizationId: orgA,
            name: 'bad',
            label: 'Bad',
            sourceObjectTypeId: contactA,
            targetObjectTypeId: contactA,
            cardinality: 'SOME_TO_SOME',
          },
        }),
      ),
    ).rejects.toThrow(CHECK);
  });

  it('links records only within a tenant', async () => {
    const def = await as(orgA, (tx) =>
      tx.associationDefinition.create({
        data: {
          organizationId: orgA,
          name: 'contact_contact',
          label: 'Related',
          sourceObjectTypeId: contactA,
          targetObjectTypeId: contactA,
          cardinality: 'MANY_TO_MANY',
        },
      }),
    );
    const mk = (org: bigint, type: bigint) =>
      as(org, (tx) =>
        tx.objectRecord.create({ data: { organizationId: org, objectTypeId: type, properties: {} } }),
      );
    const [r1, r2, foreign] = [await mk(orgA, contactA), await mk(orgA, contactA), await mk(orgB, contactB)];

    await as(orgA, (tx) =>
      tx.association.create({
        data: { organizationId: orgA, definitionId: def.id, sourceId: r1.id, targetId: r2.id },
      }),
    );
    await expect(
      as(orgA, (tx) =>
        tx.association.create({
          data: { organizationId: orgA, definitionId: def.id, sourceId: r1.id, targetId: foreign.id },
        }),
      ),
    ).rejects.toThrow(FK);
    expect(await as(orgB, (tx) => tx.association.count())).toBe(0);
  });

  it('refuses to delete an object type that still has records', async () => {
    await expect(
      prisma.objectType.delete({ where: { id: contactA } }),
    ).rejects.toThrow(FK);
  });

  it('keeps RLS forced on every tenant table', async () => {
    const rows = await prisma.$queryRaw<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
      WHERE relname IN ('object_type','field_definition','record','association_definition','association')`;
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.relrowsecurity && r.relforcerowsecurity)).toBe(true);
  });
});

import { resolve } from 'node:path';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from './prisma.service';

const RLS = /row-level security/;
const INVALID_ID = /must be/;

config({ path: resolve(__dirname, '../../../../.env'), quiet: true });

// Real-database test. Needs TEST_DATABASE_URL pointing at a database of its own, built from the
// migration files (see core-data-model.spec.ts). It creates and drops probe tables, so it must never
// run against the database you develop in.
const url = process.env.TEST_DATABASE_URL;

/** PrismaService reads DATABASE_URL, so point it at the test database for just as long as it takes to build. */
function connect(connectionString: string) {
  const before = process.env.DATABASE_URL;
  process.env.DATABASE_URL = connectionString;
  try {
    return new PrismaService();
  } finally {
    if (before === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = before;
  }
}

describe.skipIf(!url)('tenant isolation (row-level security)', () => {
  const prisma = url ? connect(url) : (undefined as never);

  const insert = (tx: Pick<PrismaService, '$executeRawUnsafe'>, table: string, org: number | null) =>
    tx.$executeRawUnsafe(`INSERT INTO ${table} ("organizationId", note) VALUES ($1, 'x')`, org);
  const count = async (tx: Pick<PrismaService, '$queryRawUnsafe'>, table: string) =>
    Number(((await tx.$queryRawUnsafe(`SELECT count(*) AS n FROM ${table}`)) as { n: bigint }[])[0].n);

  beforeAll(async () => {
    await prisma.$connect();
    for (const t of ['tenancy_probe', 'tenancy_probe_global']) {
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${t}`);
      await prisma.$executeRawUnsafe(
        `CREATE TABLE ${t} (id bigserial PRIMARY KEY, "organizationId" bigint, note text)`,
      );
    }
    await prisma.$executeRawUnsafe(`CALL enable_tenant_rls('tenancy_probe')`);
    await prisma.$executeRawUnsafe(
      `CALL enable_tenant_rls('tenancy_probe_global', 'organizationId', true)`,
    );
    await prisma.withTenant({ organizationId: 1 }, (tx) => insert(tx, 'tenancy_probe', 1));
    await prisma.withTenant({ organizationId: 2 }, (tx) => insert(tx, 'tenancy_probe', 2));
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS tenancy_probe, tenancy_probe_global');
    await prisma.$disconnect();
  });

  it('only returns the current tenant\'s rows', async () => {
    expect(await prisma.withTenant({ organizationId: 1 }, (tx) => count(tx, 'tenancy_probe'))).toBe(1);
    expect(await prisma.withTenant({ organizationId: 2 }, (tx) => count(tx, 'tenancy_probe'))).toBe(1);
  });

  it('rejects inserting a row for another tenant', async () => {
    await expect(
      prisma.withTenant({ organizationId: 1 }, (tx) => insert(tx, 'tenancy_probe', 2)),
    ).rejects.toThrow(RLS);
  });

  it('cannot update or delete another tenant\'s rows', async () => {
    const [updated, deleted] = await prisma.withTenant({ organizationId: 1 }, async (tx) => [
      await tx.$executeRawUnsafe(`UPDATE tenancy_probe SET note = 'hacked' WHERE "organizationId" = 2`),
      await tx.$executeRawUnsafe(`DELETE FROM tenancy_probe WHERE "organizationId" = 2`),
    ]);
    expect([updated, deleted]).toEqual([0, 0]);
    expect(await prisma.withTenant({ organizationId: 2 }, (tx) => count(tx, 'tenancy_probe'))).toBe(1);
  });

  it('fails closed when no tenant is set', async () => {
    const n = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE zuko_app');
      return count(tx, 'tenancy_probe');
    });
    expect(n).toBe(0);
  });

  it('does not leak the tenant context after the transaction', async () => {
    await prisma.withTenant({ organizationId: 1 }, (tx) => count(tx, 'tenancy_probe'));
    // Plain client (owner role, no tenant context) sees both tenants' rows.
    expect(await count(prisma, 'tenancy_probe')).toBe(2);
  });

  it('exposes the actor to SQL', async () => {
    const [{ id }] = await prisma.withTenant({ organizationId: 1, actorId: 42 }, (tx) =>
      tx.$queryRawUnsafe<{ id: bigint }[]>('SELECT app_actor_id() AS id'),
    );
    expect(id).toBe(42n);
  });

  it('allows org-less inserts only where enabled, and never exposes them', async () => {
    await prisma.withTenant({ organizationId: 1 }, (tx) => insert(tx, 'tenancy_probe_global', null));
    expect(await prisma.withTenant({ organizationId: 1 }, (tx) => count(tx, 'tenancy_probe_global'))).toBe(0);
    expect(await count(prisma, 'tenancy_probe_global')).toBe(1);
    await expect(
      prisma.withTenant({ organizationId: 1 }, (tx) => insert(tx, 'tenancy_probe_global', 2)),
    ).rejects.toThrow(RLS);
    await expect(
      prisma.withTenant({ organizationId: 1 }, (tx) => insert(tx, 'tenancy_probe', null)),
    ).rejects.toThrow(RLS);
  });

  it('rejects invalid tenant ids', async () => {
    await expect(prisma.withTenant({ organizationId: 0 }, async () => 1)).rejects.toThrow(INVALID_ID);
    await expect(prisma.withTenant({ organizationId: 1.5 }, async () => 1)).rejects.toThrow(INVALID_ID);
  });
});

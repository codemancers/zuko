import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { provisionStandardObjects } from './provision-standard-objects';

config({ path: resolve(__dirname, '../../../../.env'), quiet: true });
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('CRM provisioning transactions', () => {
  let prisma: PrismaService;
  const organizations: bigint[] = [];
  const suffix = `provision-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  beforeAll(() => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url;
    prisma = new PrismaService();
    process.env.DATABASE_URL = previous;
  });
  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: organizations } } });
    await prisma.$disconnect();
  });
  async function organization(name: string) {
    const org = await prisma.organization.create({ data: { name, slug: `${suffix}-${name}` } });
    organizations.push(org.id);
    return org.id;
  }

  it('serializes concurrent provisioning and preserves customized and removed fields', async () => {
    const organizationId = await organization('repeat');
    const provision = () =>
      prisma.withTenant({ organizationId }, (tx) => provisionStandardObjects(tx, organizationId));
    const created = (await Promise.all([provision(), provision(), provision()])).flat().sort();
    expect(created).toEqual(['company', 'contact', 'deal']);
    await prisma.withTenant({ organizationId }, async (tx) => {
      const contact = await tx.objectType.findFirstOrThrow({
        where: { organizationId, slug: 'contact' },
      });
      await tx.fieldDefinition.update({
        where: { objectTypeId_name: { objectTypeId: contact.id, name: 'email' } },
        data: { label: 'Work email', deletedAt: new Date() },
      });
    });
    expect(await provision()).toEqual([]);
    const fields = await prisma.withTenant({ organizationId }, (tx) =>
      tx.fieldDefinition.findMany({ where: { organizationId, name: 'email' } }),
    );
    expect(fields).toHaveLength(1);
    expect(fields[0].label).toBe('Work email');
    expect(fields[0].deletedAt).not.toBeNull();
  });

});

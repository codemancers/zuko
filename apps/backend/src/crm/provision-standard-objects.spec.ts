import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { provisionStandardObjects, StandardObjectConflict } from './provision-standard-objects';

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
    expect(created).toEqual(['company', 'contact', 'deal', 'lead', 'prospect']);
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
      tx.fieldDefinition.findMany({ where: { organizationId, name: 'email', objectType: { slug: 'contact' } } }),
    );
    expect(fields).toHaveLength(1);
    expect(fields[0].label).toBe('Work email');
    expect(fields[0].deletedAt).not.toBeNull();
  });

  it('adds fields and objects introduced later without touching what the organization changed', async () => {
    const organizationId = await organization('upgrade');
    const provision = () =>
      prisma.withTenant({ organizationId }, (tx) => provisionStandardObjects(tx, organizationId));
    await provision();
    // Make this look like an organization set up before prospects and leads existed.
    await prisma.withTenant({ organizationId }, async (tx) => {
      await tx.objectType.deleteMany({ where: { organizationId, slug: { in: ['prospect', 'lead'] } } });
      const company = await tx.objectType.findFirstOrThrow({ where: { organizationId, slug: 'company' } });
      await tx.fieldDefinition.deleteMany({ where: { organizationId, objectTypeId: company.id, name: 'status' } });
      await tx.fieldDefinition.update({
        where: { objectTypeId_name: { objectTypeId: company.id, name: 'city' } },
        data: { label: 'Headquarters' },
      });
    });
    expect(await provision()).toEqual(['prospect', 'lead']);
    expect(await provision()).toEqual([]);
    await prisma.withTenant({ organizationId }, async (tx) => {
      const company = await tx.objectType.findFirstOrThrow({ where: { organizationId, slug: 'company' } });
      const fields = await tx.fieldDefinition.findMany({ where: { organizationId, objectTypeId: company.id } });
      expect(fields.find((f) => f.name === 'status')?.config).toEqual({
        options: ['prospect', 'active', 'customer', 'partner', 'churned'],
      });
      expect(fields.find((f) => f.name === 'city')?.label).toBe('Headquarters');
      const links = await tx.associationDefinition.findMany({
        where: { organizationId, name: { in: ['prospect_lead', 'lead_contact'] } },
        select: { many: true },
      });
      expect(links).toEqual([{ many: false }, { many: false }]);
      const lead = await tx.objectType.findFirstOrThrow({ where: { organizationId, slug: 'lead' } });
      expect(
        (await tx.fieldDefinition.findFirstOrThrow({ where: { objectTypeId: lead.id, name: 'converted_contact' } })).config,
      ).toEqual({ link: 'lead_contact', target: 'contact', many: false });
    });
  });

  it('rolls back earlier objects if a later key conflicts, leaving custom data intact', async () => {
    const organizationId = await organization('conflict');
    await prisma.withTenant({ organizationId }, (tx) =>
      tx.objectType.create({
        data: {
          organizationId,
          slug: 'company',
          label: 'Custom company',
          pluralLabel: 'Custom companies',
          kind: 'CUSTOM',
        },
      }),
    );
    await expect(
      prisma.withTenant({ organizationId }, (tx) => provisionStandardObjects(tx, organizationId)),
    ).rejects.toBeInstanceOf(StandardObjectConflict);
    const objects = await prisma.withTenant({ organizationId }, (tx) =>
      tx.objectType.findMany({ where: { organizationId } }),
    );
    expect(objects.map((object) => [object.slug, object.kind])).toEqual([['company', 'CUSTOM']]);
  });

  it('does not read or write another tenant’s setup state', async () => {
    const a = await organization('a');
    const b = await organization('b');
    await prisma.withTenant({ organizationId: a }, (tx) =>
      tx.organizationSetup.create({ data: { organizationId: a } }),
    );
    expect(
      await prisma.withTenant({ organizationId: b }, (tx) => tx.organizationSetup.findMany()),
    ).toEqual([]);
    await expect(
      prisma.withTenant({ organizationId: b }, (tx) =>
        tx.organizationSetup.create({ data: { organizationId: a } }),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

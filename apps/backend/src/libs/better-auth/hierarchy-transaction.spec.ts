import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { createAuth } from './auth';
import { hierarchyTransaction } from './hierarchy-transaction';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('hierarchy transaction', () => {
  const prisma = url
    ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
    : (undefined as never);
  const suffix = randomUUID();
  let organizationId: bigint;
  let userId: bigint;

  beforeAll(async () => {
    organizationId = (
      await prisma.organization.create({
        data: { name: 'Hierarchy transaction', slug: `hierarchy-${suffix}` },
      })
    ).id;
    userId = (
      await prisma.user.create({
        data: { name: 'Worker', email: `hierarchy-${suffix}@example.test` },
      })
    ).id;
  });
  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('rolls back the reporting change if rebuilding the closure fails', async () => {
    const transaction = hierarchyTransaction(prisma);
    await expect(
      transaction(
        { organizationId: String(organizationId), options: createAuth(prisma).options },
        async (adapter) => {
          await adapter.create({
            model: 'memberReporting',
            data: {
              organizationId: String(organizationId),
              userId: String(userId),
              managerId: null,
            },
          });
          throw new Error('Closure rebuild failed');
        },
      ),
    ).rejects.toThrow('Closure rebuild failed');
    expect(await prisma.memberReporting.count({ where: { organizationId } })).toBe(0);
  });
});

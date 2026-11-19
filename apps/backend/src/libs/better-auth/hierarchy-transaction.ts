import { prismaAdapter } from '@better-auth/prisma-adapter';
import type { HierarchyOptions } from '@zuko/better-auth-hierarchy';
import type { PrismaClient } from '../../generated/prisma/client';
import { runInTenant } from '../../prisma/tenant-transaction';

/** Lock before reading reporting lines; commit the line and its closure together. */
export function hierarchyTransaction(
  prisma: PrismaClient,
): NonNullable<HierarchyOptions['transaction']> {
  return async ({ organizationId, options }, work) => {
    await runInTenant(prisma, { organizationId: BigInt(organizationId) }, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`hierarchy:${organizationId}`}))`;
      const adapter = prismaAdapter(tx, { provider: 'postgresql' })(options);
      await work(adapter);
    });
  };
}

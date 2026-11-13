import type { PrismaClient } from '../../generated/prisma/client';

/**
 * better-auth `session.create.before` hook: start each new session in the user's
 * earliest membership, or with no active organization if they have none.
 */
export function activeOrganizationOnSessionCreate(prisma: PrismaClient) {
  return async <T extends { userId: string | number | bigint }>(session: T) => {
    const membership = await prisma.member.findFirst({
      where: { userId: BigInt(session.userId) },
      orderBy: { createdAt: 'asc' },
      select: { organizationId: true },
    });
    return {
      data: {
        ...session,
        activeOrganizationId: membership ? Number(membership.organizationId) : null,
      },
    };
  };
}

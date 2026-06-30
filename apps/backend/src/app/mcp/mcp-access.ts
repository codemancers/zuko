import type { PrismaClient } from '@zuko/models';

type DbForAssignee = Pick<PrismaClient, 'member' | 'user'>;

/**
 * Task visibility for a multi-org MCP user: a task is visible when its
 * organizationId is one the user is a member of, OR the user is a TaskOwner
 * on the task. Optional organizationId filter is ANDed on top.
 */
export function mcpVisibleTaskWhere(
  userId: number,
  orgIds: number[],
  filters: { organizationId?: number } = {},
) {
  const orgFilter = filters.organizationId ?? { in: orgIds };
  return {
    OR: [
      { organizationId: orgFilter },
      {
        owners: { some: { userId } },
        organizationId: orgFilter,
      },
    ],
  };
}

/**
 * Validates that assigneeId is a member of the organization and resolves their
 * display name. Throws if they are not an org member.
 */
export async function resolveOrgMemberName(
  prisma: DbForAssignee,
  orgId: number,
  assigneeId: number,
): Promise<string> {
  const member = await prisma.member.findFirst({
    where: { organizationId: orgId, userId: assigneeId },
  });

  if (!member) {
    throw new Error(
      `User ${assigneeId} is not a member of organization ${orgId}`,
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: assigneeId },
    select: { name: true },
  });

  return user?.name ?? '';
}

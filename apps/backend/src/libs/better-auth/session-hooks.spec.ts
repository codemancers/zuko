import type { PrismaClient } from '../../generated/prisma/client';
import { activeOrganizationOnSessionCreate } from './session-hooks';

function setup(membership: { organizationId: bigint } | null) {
  const findFirst = vi.fn().mockResolvedValue(membership);
  const prisma = { member: { findFirst } } as unknown as PrismaClient;
  return { findFirst, hook: activeOrganizationOnSessionCreate(prisma) };
}

describe('activeOrganizationOnSessionCreate', () => {
  it("activates the user's earliest organization", async () => {
    const { hook, findFirst } = setup({ organizationId: 7n });

    const result = await hook({ userId: '3', token: 't' });

    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: 3n },
      orderBy: { createdAt: 'asc' },
      select: { organizationId: true },
    });
    expect(result.data).toEqual({ userId: '3', token: 't', activeOrganizationId: 7 });
  });

  it('leaves no active organization when the user has none', async () => {
    const { hook } = setup(null);

    const result = await hook({ userId: '3' });

    expect(result.data.activeOrganizationId).toBeNull();
  });

  it('keeps the rest of the session untouched', async () => {
    const { hook } = setup({ organizationId: 7n });

    const result = await hook({ userId: '3', ipAddress: '1.2.3.4', expiresAt: 5 });

    expect(result.data).toMatchObject({ userId: '3', ipAddress: '1.2.3.4', expiresAt: 5 });
  });
});

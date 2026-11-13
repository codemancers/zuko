import type { PrismaClient } from '../../generated/prisma/client';
import { activeOrganizationOnSessionCreate } from './session-hooks';

function setup(membership: { organizationId: string } | null) {
  const findFirst = vi.fn().mockResolvedValue(membership);
  const prisma = { member: { findFirst } } as unknown as PrismaClient;
  return { findFirst, hook: activeOrganizationOnSessionCreate(prisma) };
}

describe('activeOrganizationOnSessionCreate', () => {
  it("activates the user's earliest organization", async () => {
    const { hook, findFirst } = setup({ organizationId: 'org_1' });

    const result = await hook({ userId: 'user_1', token: 't' });

    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      orderBy: { createdAt: 'asc' },
      select: { organizationId: true },
    });
    expect(result.data).toEqual({ userId: 'user_1', token: 't', activeOrganizationId: 'org_1' });
  });

  it('leaves no active organization when the user has none', async () => {
    const { hook } = setup(null);

    const result = await hook({ userId: 'user_1' });

    expect(result.data.activeOrganizationId).toBeNull();
  });

  it('keeps the rest of the session untouched', async () => {
    const { hook } = setup({ organizationId: 'org_1' });

    const result = await hook({ userId: 'user_1', ipAddress: '1.2.3.4', expiresAt: 5 });

    expect(result.data).toMatchObject({ userId: 'user_1', ipAddress: '1.2.3.4', expiresAt: 5 });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { mcpVisibleTaskWhere, resolveOrgMemberName } from './mcp-access';

function fakeDb(opts: {
  member?: object | null;
  user?: { name: string | null } | null;
}) {
  return {
    member: { findFirst: vi.fn(async () => opts.member ?? null) },
    user: { findUnique: vi.fn(async () => opts.user ?? null) },
  } as never;
}

describe('mcpVisibleTaskWhere', () => {
  it('includes org-membership branch', () => {
    const where = mcpVisibleTaskWhere(42, [1]);
    expect(where.OR).toContainEqual({ organizationId: { in: [1] } });
  });

  it('includes task-owner branch', () => {
    const where = mcpVisibleTaskWhere(42, [1]);
    expect(where.OR).toContainEqual({
      owners: { some: { userId: 42 } },
      organizationId: { in: [1] },
    });
  });

  it('scopes to specific org when organizationId filter supplied', () => {
    const where = mcpVisibleTaskWhere(42, [1, 2], { organizationId: 1 });
    expect(where.OR).toContainEqual({ organizationId: 1 });
    expect(where.OR).toContainEqual({
      owners: { some: { userId: 42 } },
      organizationId: 1,
    });
  });
});

describe('resolveOrgMemberName', () => {
  it('returns name when user is org member', async () => {
    const name = await resolveOrgMemberName(
      fakeDb({ member: { id: 1 }, user: { name: 'Rishav' } }),
      1,
      42,
    );
    expect(name).toBe('Rishav');
  });

  it('falls back to empty string when user has no name', async () => {
    const name = await resolveOrgMemberName(
      fakeDb({ member: { id: 1 }, user: { name: null } }),
      1,
      42,
    );
    expect(name).toBe('');
  });

  it('throws when user is not an org member', async () => {
    await expect(
      resolveOrgMemberName(fakeDb({ member: null }), 1, 42),
    ).rejects.toThrow(/not a member of organization 1/);
  });
});

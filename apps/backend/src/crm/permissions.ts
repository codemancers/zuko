import { roles as roleDefinitions } from '@zuko/access-control';
import { Prisma } from '../generated/prisma/client';
import type { TenantTransaction } from '../prisma/prisma.service';
import type { RequestContext } from './context';
import { forbidden } from './errors';

type Authorizer = { authorize(request: Record<string, string[]>): { success: boolean } };

/** Whether any of the member's roles grants every listed action. */
export function can(ctx: Pick<RequestContext, 'roles'>, permissions: Record<string, string[]>): boolean {
  const definitions = roleDefinitions as unknown as Record<string, Authorizer | undefined>;
  return ctx.roles.some((role) => definitions[role]?.authorize(permissions).success === true);
}

export function assertCan(ctx: Pick<RequestContext, 'roles'>, permissions: Record<string, string[]>, what: string) {
  if (!can(ctx, permissions)) {
    throw forbidden(`You are not allowed to ${what}`);
  }
}

export type Scope = 'OWN' | 'OWN_AND_REPORTS' | 'TEAM' | 'ALL';
export type Mode = 'read' | 'write';
export const SCOPES: readonly Scope[] = ['OWN', 'OWN_AND_REPORTS', 'TEAM', 'ALL'];

/** Built-in scopes, used where an organization has not overridden a role. */
const DEFAULT_SCOPES: Record<string, { read: Scope; write: Scope }> = {
  owner: { read: 'ALL', write: 'ALL' },
  admin: { read: 'ALL', write: 'ALL' },
  member: { read: 'OWN_AND_REPORTS', write: 'OWN' },
};
const FALLBACK_SCOPES = { read: 'OWN', write: 'OWN' } as const;

export const defaultScopesFor = (role: string) => DEFAULT_SCOPES[role] ?? FALLBACK_SCOPES;

/**
 * Which scopes apply to this member for an object type. For each role, a row for the
 * object type wins over the role's default row, which wins over the built-in default;
 * across roles the scopes are combined (a record is reachable through any of them).
 */
export async function resolveScopes(
  tx: TenantTransaction,
  ctx: RequestContext,
  objectTypeId: bigint,
  mode: Mode,
): Promise<Set<Scope>> {
  const rows = await tx.roleObjectAccess.findMany({
    where: {
      organizationId: ctx.organizationId,
      role: { in: ctx.roles },
      OR: [{ objectTypeId }, { objectTypeId: null }],
    },
  });
  const scopes = new Set<Scope>();
  for (const role of ctx.roles) {
    const mine = rows.filter((row) => row.role === role);
    const row = mine.find((r) => r.objectTypeId !== null) ?? mine.find((r) => r.objectTypeId === null);
    const picked = row ? (mode === 'read' ? row.readScope : row.writeScope) : defaultScopesFor(role)[mode];
    scopes.add(picked as Scope);
  }
  return scopes;
}

/**
 * SQL condition (on `object_record r`) for records the member may read or write:
 * the union of their scopes, plus records explicitly shared with them or their teams.
 * Reading through a WRITE-only gap is not possible: a share must grant the mode asked for.
 */
export function visibilitySql(ctx: RequestContext, scopes: ReadonlySet<Scope>, mode: Mode): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  for (const scope of scopes) {
    if (scope === 'ALL') {
      return Prisma.sql`TRUE`;
    }
    parts.push(Prisma.sql`r."ownerId" = ${ctx.userId}`);
    if (scope === 'OWN_AND_REPORTS') {
      parts.push(Prisma.sql`r."ownerId" IN (
        SELECT "descendantId" FROM member_hierarchy
        WHERE "organizationId" = ${ctx.organizationId} AND "ancestorId" = ${ctx.userId})`);
    }
    if (scope === 'TEAM') {
      parts.push(Prisma.sql`r."teamId" = ANY(${ctx.teamIds}::bigint[])`);
    }
  }
  const needsWrite = mode === 'write' ? Prisma.sql`AND s."access" = 'WRITE'` : Prisma.empty;
  parts.push(Prisma.sql`EXISTS (
    SELECT 1 FROM record_share s
    WHERE s."organizationId" = r."organizationId" AND s."recordId" = r."id"
      AND (s."userId" = ${ctx.userId} OR s."teamId" = ANY(${ctx.teamIds}::bigint[]))
      ${needsWrite})`);
  return Prisma.sql`(${Prisma.join(parts, ' OR ')})`;
}

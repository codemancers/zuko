import type { Prisma, PrismaClient } from '../generated/prisma/client';

export interface TenantContext {
  organizationId: bigint | number;
  /** User performing the request; exposed to SQL as app_actor_id(). */
  actorId?: bigint | number | null;
}

export type TenantTransaction = Prisma.TransactionClient;

/**
 * Run `fn` inside a transaction scoped to one organization.
 *
 * The transaction drops to the non-bypass `zuko_app` role and sets `app.org_id`, so
 * row-level security policies (see `enable_tenant_rls`) apply to every query made
 * through `tx`. Both settings are transaction-local, so they cannot leak across
 * pooled connections. Only tenant data belongs here; auth tables are accessed
 * through the plain client.
 */
export async function runInTenant<T>(
  client: PrismaClient,
  ctx: TenantContext,
  fn: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  const organizationId = toId(ctx.organizationId, 'organizationId');
  const actorId = ctx.actorId == null ? '' : toId(ctx.actorId, 'actorId');

  return client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE zuko_app');
    await tx.$executeRaw`SELECT set_config('app.org_id', ${organizationId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.actor_id', ${actorId}, true)`;
    return fn(tx);
  });
}

function toId(value: bigint | number, name: string): string {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new Error(`${name} must be an integer`);
  }
  const id = BigInt(value);
  if (id <= 0n) {
    throw new Error(`${name} must be a positive integer`);
  }
  return id.toString();
}

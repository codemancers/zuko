import type { AuditWriter } from '@zuko/better-auth-audit';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import { runInTenant } from '../../prisma/tenant-transaction';

/**
 * Stores audit events through Prisma. Events that belong to an organization are
 * written inside that organization's tenant context, so the row-level security
 * policy on audit_event is satisfied even when the login role is not a superuser;
 * better-auth's own adapter has no tenant context to offer.
 */
export function auditSink(prisma: PrismaClient): AuditWriter {
  return async (event) => {
    const organizationId = event.organizationId === null ? null : BigInt(event.organizationId);
    const actorId = event.actorId === null ? null : BigInt(event.actorId);
    const data = {
      organizationId,
      actorType: event.actorType,
      actorId,
      event: event.event,
      targetType: event.targetType,
      targetId: event.targetId === null ? null : BigInt(event.targetId),
      metadata: event.metadata as Prisma.InputJsonObject,
      ip: event.ip,
      userAgent: event.userAgent,
      requestId: event.requestId,
    };

    // createMany, not create: create adds RETURNING, which must also pass the read
    // policy, and an organization-less row never does.
    if (organizationId === null) {
      await prisma.auditEvent.createMany({ data: [data] });
      return;
    }
    await runInTenant(prisma, { organizationId, actorId }, (tx) => tx.auditEvent.createMany({ data: [data] }));
  };
}

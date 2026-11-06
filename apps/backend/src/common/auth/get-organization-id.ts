import type { Request } from 'express';
import { ForbiddenException, Logger } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

const log = new Logger('GetOrganizationId');

function positiveId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Header the frontend can send with the current active organization ID (e.g. from session) */
export const ORGANIZATION_ID_HEADER = 'x-organization-id';

/** Error code the frontend can use to show "Select an organization" or redirect to org switcher */
export const NO_ACTIVE_ORGANIZATION_CODE = 'NO_ACTIVE_ORGANIZATION';

/** Request after AuthGuard: session and user attached by @thallesp/nestjs-better-auth */
interface RequestWithAuthSession extends Request {
  session?: {
    user: { id: string };
    session?: { activeOrganizationId?: string };
  };
  user?: { id: string };
}

/**
 * Returns the active organization ID from the request.
 * Uses the session and user attached by AuthGuard (better-auth). Uses an explicit X-Organization-Id header or session.session.activeOrganizationId (with single-org fallback). Every resolved organization requires current membership; an explicit unauthorized selection never falls back.
 * @throws ForbiddenException if no session or no active organization (use error.response.code === NO_ACTIVE_ORGANIZATION_CODE to detect)
 */
export async function getActiveOrganizationId(
  req: RequestWithAuthSession,
  prisma: PrismaService,
): Promise<number> {
  if (!req.session) {
    log.warn('No session on request; returning 403');
    throw new ForbiddenException({
      message: 'No session: select an organization to continue',
      code: NO_ACTIVE_ORGANIZATION_CODE,
    });
  }

  const userId = positiveId(req.user?.id ?? req.session.user?.id);
  if (userId === null) {
    log.warn('No user id in session; returning 403');
    throw new ForbiddenException({
      message: 'No session: select an organization to continue',
      code: NO_ACTIVE_ORGANIZATION_CODE,
    });
  }

  const headerOrgId = req.headers[ORGANIZATION_ID_HEADER];
  if (headerOrgId !== undefined) {
    const headerId = positiveId(headerOrgId);
    if (headerId === null) {
      throw new ForbiddenException({
        message: 'Invalid organization selection',
        code: NO_ACTIVE_ORGANIZATION_CODE,
      });
    }
    const member = await prisma.member.findFirst({
      where: { organizationId: headerId, userId },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this organization');
    }
    return headerId;
  }

  let activeOrgId: string | null =
    req.session.session?.activeOrganizationId ?? null;

  if (!activeOrgId) {
    const memberships = await prisma.member.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    if (memberships.length === 1) {
      activeOrgId = String(memberships[0].organizationId);
    }
  }

  if (!activeOrgId) {
    log.warn(`No active organization for userId=${userId}; returning 403`);
    throw new ForbiddenException({
      message: 'No active organization: select an organization to continue',
      code: NO_ACTIVE_ORGANIZATION_CODE,
    });
  }

  const organizationId = positiveId(activeOrgId);
  if (organizationId === null) {
    log.warn(`Invalid activeOrganizationId: ${activeOrgId}`);
    throw new ForbiddenException({
      message: 'Invalid active organization',
      code: NO_ACTIVE_ORGANIZATION_CODE,
    });
  }

  const member = await prisma.member.findFirst({
    where: { organizationId, userId },
  });
  if (!member) {
    throw new ForbiddenException('Not a member of this organization');
  }
  return organizationId;
}

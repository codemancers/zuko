import type { Request } from 'express';
import { ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const log = new Logger('GetOrganizationId');

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
 * Uses the session and user attached by AuthGuard (better-auth). Prefers X-Organization-Id header when present and user is a member; otherwise session.session.activeOrganizationId (with single-org fallback).
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

  const userId = parseInt(req.user?.id ?? req.session.user?.id ?? '', 10);
  if (Number.isNaN(userId)) {
    log.warn('No user id in session; returning 403');
    throw new ForbiddenException({
      message: 'No session: select an organization to continue',
      code: NO_ACTIVE_ORGANIZATION_CODE,
    });
  }

  const headerOrgId = req.headers[ORGANIZATION_ID_HEADER];
  const headerId =
    typeof headerOrgId === 'string' ? parseInt(headerOrgId.trim(), 10) : NaN;
  if (Number.isNaN(headerId) === false && headerId > 0) {
    const member = await prisma.member.findFirst({
      where: { organizationId: headerId, userId },
    });
    if (member) {
      return headerId;
    }
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

  const organizationId = parseInt(activeOrgId, 10);
  if (Number.isNaN(organizationId)) {
    log.warn(`Invalid activeOrganizationId: ${activeOrgId}`);
    throw new ForbiddenException({
      message: 'Invalid active organization',
      code: NO_ACTIVE_ORGANIZATION_CODE,
    });
  }

  return organizationId;
}

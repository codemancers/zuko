import { CanActivate, ExecutionContext, Injectable, createParamDecorator } from '@nestjs/common';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { badRequest, forbidden } from './errors';

/** Who is making the request, in which organization, and what they belong to. */
export interface RequestContext {
  userId: bigint;
  organizationId: bigint;
  /** The member's organization roles (better-auth stores several as a comma-separated string). */
  roles: string[];
  teamIds: bigint[];
  requestId: string;
}

interface CrmRequest {
  session?: UserSession;
  headers: Record<string, string | string[] | undefined>;
  crm?: RequestContext;
}

/**
 * Builds the RequestContext for routes behind better-auth's global guard: the
 * session's active organization, the user's membership and roles there, and their
 * teams. Rejects requests with no active organization or no membership.
 */
@Injectable()
export class CrmContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(execution: ExecutionContext): Promise<boolean> {
    const request = execution.switchToHttp().getRequest<CrmRequest>();
    const session = request.session;
    const activeOrganizationId = (session?.session as { activeOrganizationId?: unknown } | undefined)
      ?.activeOrganizationId;
    if (!session || activeOrganizationId == null || activeOrganizationId === '') {
      throw badRequest('NO_ACTIVE_ORGANIZATION', 'No active organization; select one first');
    }

    const userId = BigInt(session.user.id as string | number);
    const organizationId = BigInt(activeOrganizationId as string | number);
    const member = await this.prisma.member.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    });
    if (!member) {
      throw forbidden('You are not a member of this organization');
    }
    const teams = await this.prisma.teamMember.findMany({
      where: { userId, team: { organizationId } },
      select: { teamId: true },
    });

    const header = request.headers['x-request-id'];
    request.crm = {
      userId,
      organizationId,
      roles: member.role
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean),
      teamIds: teams.map((team) => team.teamId),
      requestId: (Array.isArray(header) ? header[0] : header) || randomUUID(),
    };
    return true;
  }
}

/** The RequestContext built by CrmContextGuard. */
export const Crm = createParamDecorator((_data: unknown, execution: ExecutionContext): RequestContext => {
  const request = execution.switchToHttp().getRequest<CrmRequest>();
  if (!request.crm) {
    throw new Error('Crm() used on a route without CrmContextGuard');
  }
  return request.crm;
});

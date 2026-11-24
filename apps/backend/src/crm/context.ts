import { CanActivate, ExecutionContext, Injectable, createParamDecorator } from '@nestjs/common';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CrmError, badRequest, forbidden } from './errors';

/** Who is making the request, in which organization, and what they belong to. */
export interface RequestContext {
  userId: bigint;
  organizationId: bigint;
  /** The member's organization roles (better-auth stores several as a comma-separated string). */
  roles: string[];
  teamIds: bigint[];
  requestId: string;
  /** How the request arrived; recorded as the actor type in history. */
  actorType: 'USER' | 'MCP';
}

interface CrmRequest {
  session?: UserSession;
  headers: Record<string, string | string[] | undefined>;
  crm?: RequestContext;
}

/**
 * Resolves a user's standing in an organization: their membership and roles there, and
 * their teams. Used for web requests and for MCP requests, which differ only in how the
 * user and organization were established (session vs. access token).
 */
@Injectable()
export class CrmContextService {
  constructor(private readonly prisma: PrismaService) {}

  async build(input: {
    userId: bigint;
    organizationId: bigint;
    actorType: RequestContext['actorType'];
    requestId?: string | undefined;
  }): Promise<RequestContext> {
    const { userId, organizationId } = input;
    const member = await this.prisma.member.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    });
    if (!member) {
      throw forbidden('You are not a member of this organization');
    }
    const setup = await this.prisma.withTenant({ organizationId }, (tx) =>
      tx.organizationSetup.findUnique({ where: { organizationId }, select: { status: true } }),
    );
    if (setup?.status !== 'ready') {
      throw new CrmError(409, 'ORGANIZATION_NOT_READY', 'Your organization is still being set up');
    }
    const teams = await this.prisma.teamMember.findMany({
      where: { userId, team: { organizationId } },
      select: { teamId: true },
    });
    return {
      userId,
      organizationId,
      roles: member.role
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean),
      teamIds: teams.map((team) => team.teamId),
      requestId: input.requestId || randomUUID(),
      actorType: input.actorType,
    };
  }
}

/**
 * Builds the RequestContext for routes behind better-auth's global guard: the
 * session's active organization and the user's membership there. Rejects requests with
 * no active organization or no membership.
 */
@Injectable()
export class CrmContextGuard implements CanActivate {
  constructor(private readonly contexts: CrmContextService) {}

  async canActivate(execution: ExecutionContext): Promise<boolean> {
    const request = execution.switchToHttp().getRequest<CrmRequest>();
    const session = request.session;
    const activeOrganizationId = (
      session?.session as { activeOrganizationId?: unknown } | undefined
    )?.activeOrganizationId;
    if (!session || activeOrganizationId == null || activeOrganizationId === '') {
      throw badRequest('NO_ACTIVE_ORGANIZATION', 'No active organization; select one first');
    }

    const header = request.headers['x-request-id'];
    request.crm = await this.contexts.build({
      userId: BigInt(session.user.id as string | number),
      organizationId: BigInt(activeOrganizationId as string | number),
      actorType: 'USER',
      requestId: Array.isArray(header) ? header[0] : header,
    });
    return true;
  }
}

/** The RequestContext built by CrmContextGuard. */
export const Crm = createParamDecorator(
  (_data: unknown, execution: ExecutionContext): RequestContext => {
    const request = execution.switchToHttp().getRequest<CrmRequest>();
    if (!request.crm) {
      throw new Error('Crm() used on a route without CrmContextGuard');
    }
    return request.crm;
  },
);

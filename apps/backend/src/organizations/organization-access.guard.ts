import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import { defaultRoles } from 'better-auth/plugins/organization/access';
import type { IncomingHttpHeaders } from 'node:http';
import type { createAuth } from '../libs/better-auth/auth';
import { PrismaService } from '../prisma/prisma.service';
import {
  ORGANIZATION_PERMISSIONS,
  OrganizationContext,
  OrganizationPermissions,
} from './organization-access';

interface OrganizationRequest {
  method: string;
  headers: IncomingHttpHeaders;
  params: { organizationId?: unknown };
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  organization?: OrganizationContext;
}

/** Global, fail-closed boundary for Nest APIs. Better Auth owns its /auth routes. */
@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService<ReturnType<typeof createAuth>>,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    // The existing health route explicitly uses Better Auth's @AllowAnonymous().
    if (this.reflector.getAllAndOverride<boolean>('PUBLIC', targets)) return true;
    if (context.getType() !== 'http')
      throw new ForbiddenException('HTTP organisation access is required');

    const request = context.switchToHttp().getRequest<OrganizationRequest>();
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
      query: { disableCookieCache: true },
    });
    if (!session) throw new UnauthorizedException();

    // Cookie-authenticated writes need the same trusted-origin boundary as /auth.
    // Non-browser API clients may omit Origin; browser cross-site writes may not.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.origin;
      const authContext = await this.auth.instance.$context;
      if (
        (origin !== undefined &&
          !authContext.isTrustedOrigin(origin, { allowRelativePaths: false })) ||
        (origin === undefined && request.headers['sec-fetch-site'] === 'cross-site')
      ) {
        throw new ForbiddenException('Untrusted request origin');
      }
    }

    const permissions = this.reflector.getAllAndOverride<OrganizationPermissions>(
      ORGANIZATION_PERMISSIONS,
      targets,
    );
    if (!permissions) throw new ForbiddenException('Organisation access policy is required');

    const organizationId = request.params.organizationId;
    if (
      typeof organizationId !== 'string' ||
      !organizationId ||
      organizationId !== session.session.activeOrganizationId
    ) {
      throw new ForbiddenException('Select the requested organisation first');
    }
    // Never silently fall back when a caller sends conflicting tenant selectors.
    for (const supplied of [
      request.headers['x-organization-id'],
      request.query?.organizationId,
      request.body?.organizationId,
    ]) {
      if (supplied !== undefined && supplied !== organizationId) {
        throw new ForbiddenException('Conflicting organisation selection');
      }
    }

    // Read current membership on every request; never authorize from cached role claims.
    const member = await this.prisma.member.findFirst({
      where: { userId: session.user.id, organizationId },
      select: { role: true },
    });
    if (!member) throw new ForbiddenException('Organisation membership is required');

    const roles = member.role.split(',').map((role) => role.trim());
    if (!roles.length || roles.some((role) => !Object.hasOwn(defaultRoles, role))) {
      throw new ForbiddenException('Unsupported organisation role');
    }
    const allowed =
      Object.keys(permissions).length === 0 ||
      roles.some(
        (role) => defaultRoles[role as keyof typeof defaultRoles].authorize(permissions).success,
      );
    if (!allowed) throw new ForbiddenException('Insufficient organisation permissions');

    request.organization = Object.freeze({
      organizationId,
      userId: session.user.id,
      role: member.role,
    });
    return true;
  }
}

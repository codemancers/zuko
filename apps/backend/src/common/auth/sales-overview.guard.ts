import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import type { RequestWithOrganization } from '@zuko/core';
// Runtime import is required for Nest constructor injection metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../../prisma/prisma.service';
import { getActiveOrganizationId } from './get-organization-id';

function positiveId(value: unknown): number {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    !/^\d+$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) <= 0
  ) {
    throw new ForbiddenException('Invalid authenticated user or organization');
  }
  return Number(value);
}

/** Opt-in guard for Sales Overview only. Use after AuthGuard; resolves the
 * organization itself. Register with PrismaModule in the consuming module.
 * Never use application-level RolesGuard as a substitute for membership. */
@Injectable()
export class SalesOverviewGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<
        RequestWithOrganization & Parameters<typeof getActiveOrganizationId>[0]
      >();
    // Fail closed on malformed selections; the general resolver intentionally
    // falls back for legacy callers, but a protected dashboard must not silently
    // serve another organization's data after a rejected explicit selection.
    const userId = positiveId(request.session?.user?.id);
    if (request.user && positiveId(request.user.id) !== userId) {
      throw new ForbiddenException('Inconsistent authenticated identity');
    }
    const header = request.headers['x-organization-id'];
    const selectedId = header !== undefined ? positiveId(header) : undefined;
    const activeId = request.session?.session?.activeOrganizationId;
    if (selectedId === undefined && activeId != null) positiveId(activeId);
    const organizationId = positiveId(
      await getActiveOrganizationId(request, this.prisma),
    );
    if (selectedId !== undefined && organizationId !== selectedId) {
      throw new ForbiddenException('Organization selection is not permitted');
    }
    const member = await this.prisma.member.findFirst({
      where: { organizationId, userId },
      select: { role: true },
    });
    if (member?.role !== 'owner' && member?.role !== 'admin') {
      throw new ForbiddenException(
        'Sales Overview requires organization Owner or Admin membership',
      );
    }
    request.organizationId = organizationId;
    return true;
  }
}

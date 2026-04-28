import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { getActiveOrganizationId } from './get-organization-id';
import type { PrismaService } from '../../prisma/prisma.service';
import type { RequestWithOrganization } from '@zuko/core';

/**
 * Guard that resolves the active organization from the session (or X-Organization-Id header) and attaches it to the request.
 * Use after AuthGuard so the user is authenticated. Use on controllers/routes that need
 * organization-scoped data (contacts, companies, deals).
 *
 * @example
 * @Controller('contacts')
 * @UseGuards(AuthGuard, OrganizationGuard)
 * export class ContactsController {
 *   create(@OrgId() organizationId: number, @Body() dto: CreateContactDto) { ... }
 * }
 */
@Injectable()
export class OrganizationGuard implements CanActivate {
  private readonly logger = new Logger(OrganizationGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithOrganization>();
    const method = request.method;
    const path = request.path ?? request.url;
    this.logger.debug(`Resolving organization for ${method} ${path}`);
    const organizationId = await getActiveOrganizationId(request, this.prisma);
    request.organizationId = organizationId;
    this.logger.debug(`Organization resolved: organizationId=${organizationId} for ${method} ${path}`);
    return true;
  }
}

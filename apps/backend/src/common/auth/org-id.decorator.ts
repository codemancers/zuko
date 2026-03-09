import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { RequestWithOrganization } from '@zuko/core';

/**
 * Parameter decorator that returns the active organization ID from the request.
 * Requires OrganizationGuard to run first (so request.organizationId is set).
 *
 * @example
 * @Get()
 * list(@OrgId() organizationId: number, @Query() query: ContactListQueryDto) {
 *   return this.contactsService.findAll({ organizationId, ... }, pagination);
 * }
 */
export const OrgId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest<RequestWithOrganization>();
    return request.organizationId;
  },
);

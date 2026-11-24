import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import type { defaultStatements } from 'better-auth/plugins/organization/access';

export const ORGANIZATION_PERMISSIONS = 'zuko:organization-permissions';
export type OrganizationPermissions = {
  [Resource in keyof typeof defaultStatements]?: (typeof defaultStatements)[Resource][number][];
};

/** Membership is always required; actions use Better Auth's existing role policy. */
export const RequireOrganization = (permissions: OrganizationPermissions = {}) =>
  SetMetadata(ORGANIZATION_PERMISSIONS, permissions);

export interface OrganizationContext {
  readonly organizationId: string;
  readonly userId: string;
  readonly role: string;
}

export const CurrentOrganization = createParamDecorator(
  (_data: unknown, context: ExecutionContext): OrganizationContext => {
    const organization = context.switchToHttp().getRequest().organization;
    if (!organization) throw new ForbiddenException('Organisation access is required');
    return organization;
  },
);

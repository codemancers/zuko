import type { Request } from 'express';

/**
 * Request with authenticated user (set by AuthGuard)
 */
export interface RequestWithUser extends Request {
  user: {
    id: string;
    email?: string;
    name?: string;
    role?: string;
    [key: string]: unknown;
  };
}

/**
 * Request with user and active organization (set by OrganizationGuard after AuthGuard).
 * Use for routes that scope data to the current organization.
 */
export interface RequestWithOrganization extends RequestWithUser {
  organizationId: number;
}

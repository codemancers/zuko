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

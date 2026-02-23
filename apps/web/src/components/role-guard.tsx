'use client';

import { useUserRole, UserRole } from '@/hooks/use-user-role';
import { ReactNode } from 'react';

interface RoleGuardProps {
  /**
   * Required role(s) to view the content.
   * If an array is provided, user must have ANY of the roles.
   */
  role: UserRole | UserRole[];
  /**
   * Content to render if user has the required role
   */
  children: ReactNode;
  /**
   * Optional fallback content to render if user doesn't have the required role
   */
  fallback?: ReactNode;
  /**
   * Optional loading content while checking role
   */
  loading?: ReactNode;
}

/**
 * Component that conditionally renders children based on user role
 *
 * @example
 * ```tsx
 * <RoleGuard role="admin">
 *   <AdminPanel />
 * </RoleGuard>
 *
 * <RoleGuard role={['admin', 'accountant']} fallback={<p>Access denied</p>}>
 *   <FinancialData />
 * </RoleGuard>
 * ```
 */
export function RoleGuard({ role, children, fallback = null, loading: loadingContent = null }: RoleGuardProps) {
  const { role: userRole, loading } = useUserRole();

  if (loading) {
    return <>{loadingContent}</>;
  }

  const requiredRoles = Array.isArray(role) ? role : [role];
  const hasAccess = requiredRoles.includes(userRole);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

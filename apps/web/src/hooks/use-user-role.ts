'use client';

import { authClient } from '@/lib/auth-client';

export type UserRole = 'none' | 'admin' | 'accountant';

export function useUserRole() {
  const session = authClient.useSession();
  const role = ((session.data?.user as any)?.role ?? 'none') as UserRole;

  return {
    role,
    loading: session.isPending,
    isAdmin: role === 'admin',
    isAccountant: role === 'accountant',
    isNone: role === 'none',
    hasRole: (requiredRole: UserRole) => role === requiredRole,
    hasAnyRole: (roles: UserRole[]) => roles.includes(role),
  };
}

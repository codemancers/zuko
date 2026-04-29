'use client';

import { authClient } from '@/lib/auth-client';

export type UserRole = 'none' | 'admin' | 'accountant' | 'owner' | 'member';

export function useUserRole() {
  const session = authClient.useSession();
  const activeOrg = authClient.useActiveOrganization();

  const appRole = ((session.data?.user as any)?.role ?? 'none') as UserRole;
  const currentUserId = session.data?.user?.id;
  const orgMember = (activeOrg.data as any)?.members?.find(
    (m: any) => m.userId === currentUserId,
  );
  const orgRole = (orgMember?.role ?? 'none') as UserRole;

  // Org owner/admin counts as admin for app-level access
  const effectiveRole: UserRole = appRole !== 'none' ? appRole : orgRole;

  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'owner';

  return {
    role: effectiveRole,
    orgRole,
    loading: session.isPending,
    isAdmin,
    isOwner: effectiveRole === 'owner',
    isAccountant: effectiveRole === 'accountant',
    isNone: effectiveRole === 'none',
    hasRole: (requiredRole: UserRole) => effectiveRole === requiredRole,
    hasAnyRole: (roles: UserRole[]) => roles.includes(effectiveRole),
  };
}

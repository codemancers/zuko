'use client';

import { authClient } from '@/lib/auth-client';

/** UI eligibility only. Every protected request must use SalesOverviewGuard.
 * Intentionally does not use useUserRole's application-role fallback. */
export function useSalesOverviewAccess() {
  const session = authClient.useSession();
  const organization = authClient.useActiveOrganization();
  const loading = session.isPending || organization.isPending;
  const activeId = session.data?.session.activeOrganizationId;
  const userId = session.data?.user.id;
  const currentOrganization = Boolean(
    activeId &&
    organization.data &&
    String(activeId) === String(organization.data.id),
  );
  const member =
    userId && currentOrganization
      ? organization.data?.members.find(
          (candidate) => String(candidate.userId) === String(userId),
        )
      : undefined;
  return {
    allowed:
      !loading &&
      !session.error &&
      !organization.error &&
      (member?.role === 'owner' || member?.role === 'admin'),
    loading,
  };
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';

export type SetupProgress = {
  status: 'running' | 'ready' | 'failed';
  message: string;
  step?: 'prepare' | 'crm' | 'finish';
};

export function mergeSetupProgress(current: SetupProgress | undefined, update: SetupProgress): SetupProgress {
  return { ...update, step: update.step ?? current?.step };
}

export const organizationSetupKey = (organizationId?: string, userId?: string) =>
  ['organization-setup', organizationId, userId] as const;

/** Reuse readiness across pages; organization selection and the setup screen refresh it. */
export function useOrganizationSetup() {
  const { data: organization } = authClient.useActiveOrganization();
  const { data: session } = authClient.useSession();
  return useQuery({
    queryKey: organizationSetupKey(organization?.id, session?.user.id),
    enabled: !!organization && !!session,
    queryFn: async ({ signal }): Promise<SetupProgress> => {
      const response = await fetch(`/api/organizations/${organization!.id}/setup`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal,
      });
      if (!response.ok) throw new Error('Could not check organization setup.');
      const snapshot = await response.json();
      if (!['running', 'ready', 'failed'].includes(snapshot.status) || typeof snapshot.message !== 'string') {
        throw new Error('Invalid organization setup response.');
      }
      return snapshot;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

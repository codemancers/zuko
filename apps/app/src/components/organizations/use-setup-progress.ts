import { useState } from 'react';
import { experimental_streamedQuery as streamedQuery, useQuery } from '@tanstack/react-query';
import { mergeSetupProgress, organizationSetupKey, type SetupProgress } from '@/lib/organization-setup';
import { organizationSetupEvents, type SetupConnection } from '@/lib/organization-setup-events';

const initialSetupProgress: SetupProgress = {
  status: 'running',
  message: 'Connecting to setup progress…',
};

/** The stream and readiness snapshot share a cache; connection errors stay local. */
export function useSetupProgress(organizationId: string, userId: string) {
  const [connection, setConnection] = useState<SetupConnection>('connected');
  const { data: progress = initialSetupProgress } = useQuery({
    queryKey: organizationSetupKey(organizationId, userId),
    queryFn: streamedQuery({
      streamFn: ({ signal }) => organizationSetupEvents(`/api/organizations/${organizationId}/setup`, signal, setConnection),
      reducer: mergeSetupProgress,
      initialValue: initialSetupProgress,
      refetchMode: 'append',
    }),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  return { progress, connection };
}

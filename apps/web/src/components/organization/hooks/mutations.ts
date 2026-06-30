'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { getGitHubInstallationUrl } from '../server/fetch';
import { connectionQueryKeys } from '../server/query-options';
import { toast } from 'sonner';

export function useConnectAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (provider: 'github' | 'google') =>
      authClient.linkSocial({
        provider,
        callbackURL: `${window.location.origin}/settings`,
      }),
    onSuccess: (result) => {
      if (result?.error) {
        toast.error(result.error.message || 'Failed to connect');
        return;
      }
      queryClient.invalidateQueries({
        queryKey: connectionQueryKeys.accounts(),
      });
    },
    onError: (err: Error) => toast.error(err?.message || 'Failed to connect'),
  });
}

export function useDisconnectAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const response = await fetch('/api/auth/unlink-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ accountId }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: 'Failed to disconnect' }));
        throw new Error(error.message || 'Failed to disconnect account');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Account disconnected');
      queryClient.invalidateQueries({
        queryKey: connectionQueryKeys.accounts(),
      });
    },
    onError: (err: Error) =>
      toast.error(err?.message || 'Failed to disconnect'),
  });
}

export function useInstallGitHubApp() {
  return useMutation({
    mutationFn: getGitHubInstallationUrl,
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
      else toast.error('Could not get GitHub App installation URL');
    },
    onError: () => toast.error('Failed to get GitHub App installation URL'),
  });
}

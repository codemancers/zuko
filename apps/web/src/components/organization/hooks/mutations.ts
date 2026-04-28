'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { getGitHubInstallationUrl } from '../server/fetch';
import { connectionQueryKeys } from '../server/query-options';
import { toast } from 'sonner';
import { getAuthBaseUrl } from './use-mcp-oauth';

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
    mutationFn: async (providerId: string) => {
      const res = await fetch(`${getAuthBaseUrl()}/unlink-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ providerId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Failed to disconnect ${providerId}`);
      }
      return res.json();
    },
    onSuccess: (_result: unknown, providerId: string) => {
      toast.success(`Disconnected ${providerId}`);
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

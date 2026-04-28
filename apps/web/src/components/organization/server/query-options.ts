import { queryOptions } from '@tanstack/react-query';
import { getGitHubInstallationStatus, fetchLinkedAccounts } from './fetch';

export const connectionQueryKeys = {
  all: ['connections'] as const,
  githubStatus: () => [...connectionQueryKeys.all, 'github-status'] as const,
  accounts: () => [...connectionQueryKeys.all, 'accounts'] as const,
};

export const githubStatusQueryOptions = () =>
  queryOptions({
    queryKey: connectionQueryKeys.githubStatus(),
    queryFn: getGitHubInstallationStatus,
  });

export const linkedAccountsQueryOptions = () =>
  queryOptions({
    queryKey: connectionQueryKeys.accounts(),
    queryFn: fetchLinkedAccounts,
  });

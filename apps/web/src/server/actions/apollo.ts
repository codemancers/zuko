'use server';

import { apolloIntegrationApi } from '@/lib/api/apollo';

export async function getApolloConnectionStatus() {
  try {
    return await apolloIntegrationApi.getConnectionStatus();
  } catch {
    return { connected: false };
  }
}

export async function getApolloAuthorizationUrl() {
  return apolloIntegrationApi.getAuthorizationUrl();
}

export async function disconnectApollo() {
  return apolloIntegrationApi.disconnect();
}

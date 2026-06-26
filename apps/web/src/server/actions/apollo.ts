'use server';

import { apolloIntegrationApi } from '@/lib/api/apollo';

export async function getApolloAuthorizationUrl() {
  return apolloIntegrationApi.getAuthorizationUrl();
}

export async function disconnectApollo() {
  return apolloIntegrationApi.disconnect();
}

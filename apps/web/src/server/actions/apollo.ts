'use server';

import { apolloIntegrationApi } from '@/lib/api/apollo';

export async function disconnectApollo() {
  return apolloIntegrationApi.disconnect();
}

export async function activateApolloConnection(nangoConnectionId: string) {
  return apolloIntegrationApi.activate(nangoConnectionId);
}

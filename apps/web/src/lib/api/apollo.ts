import { apiClient } from '../api-client';

export interface ApolloConnectionStatus {
  connected: boolean;
  connectedAt?: string;
  connectedByEmail?: string;
}

export interface ApolloAuthorizationUrl {
  url: string;
}

export const apolloIntegrationApi = {
  async getConnectionStatus(): Promise<ApolloConnectionStatus> {
    return apiClient.get('/integrations/apollo/status');
  },

  async getAuthorizationUrl(): Promise<ApolloAuthorizationUrl> {
    return apiClient.get('/integrations/apollo/authorize');
  },

  async disconnect(): Promise<void> {
    return apiClient.delete('/integrations/apollo/disconnect');
  },
};

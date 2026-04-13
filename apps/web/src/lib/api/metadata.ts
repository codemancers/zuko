import { apiClient } from '../api-client';

export interface Currency {
  code: string;
  symbol: string;
  label: string;
  name: string;
}

export const metadataApi = {
  getCurrencies: async (): Promise<Currency[]> => {
    return await apiClient.get<Currency[]>('/metadata/currencies');
  },
};

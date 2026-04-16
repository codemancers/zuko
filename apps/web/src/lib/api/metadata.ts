import { apiClient } from '../api-client';

export interface Currency {
  code: string;
  symbol: string;
  label: string;
  name: string;
}

export interface DealPriority {
  value: number;
  label: string;
}

export interface DealStage {
  value: string;
  label: string;
}

export interface TaskStatusList {
  value: string;
  label: string;
}

export const metadataApi = {
  getCurrencies: async (): Promise<Currency[]> => {
    return await apiClient.get<Currency[]>('/metadata/currencies');
  },
  getDealPriorities: async (): Promise<DealPriority[]> => {
    return await apiClient.get<DealPriority[]>('/metadata/deal/priorities');
  },
  getDealStages: async (): Promise<DealStage[]> => {
    return await apiClient.get<DealStage[]>('/metadata/deal/stages');
  },
  getTaskStatuses: async (): Promise<TaskStatusList[]> => {
    return await apiClient.get<TaskStatusList[]>('/metadata/task/status');
  },
};

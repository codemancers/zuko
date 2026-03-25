import { JSONValue } from 'next/dist/server/config-shared';
import { apiClient } from '../api-client';

export interface CreateColumnDto {
  label: string;
  columnKey: string;
  fieldType: string;
}

export interface TableColumn {
  id: number;
  organizationId: number;
  createdAt: Date;
  createdById: number;
  tableName: string;
  columnKey: string;
  label: string;
  fieldType: string;
  isRequired: boolean;
  config: JSONValue;
}

export const tablesApi = {
  /**
   * Create a new column for an entity table
   */
  async createColumn(entity: string, data: CreateColumnDto): Promise<TableColumn> {
    return apiClient.post(`/tables/${entity}/columns`, data);
  },
};

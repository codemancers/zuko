import { apiClient } from '../api-client';
import type { TableViewResponse } from '@/types/table-metadata';
import type { BaseRow } from '@/components/Table';
import type { OutputData } from '@editorjs/editorjs';

export type TableViewLeadsResponse = TableViewResponse<BaseRow>;

export interface Lead {
  id: number;
  organizationId: number;
  icpProfileId: number;
  campaignId?: number;
  contactId?: number;
  dealId?: number;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  title?: string;
  linkedinUrl?: string;
  status: 'replied' | 'interested' | 'not_interested' | 'converted';
  source: 'apollo' | 'origami' | 'linkedin' | 'manual';
  apolloPersonId?: string;
  notes?: OutputData;
  createdAt: string;
  updatedAt: string;
  icpProfile?: { id: number; name: string };
  campaign?: { id: number; name: string };
  contact?: { id: number; name: string; email?: string };
  deal?: { id: number; title: string };
}

export interface LeadsListResponse {
  data: Lead[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface CreateLeadDto {
  icpProfileId: number;
  campaignId?: number;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  title?: string;
  linkedinUrl?: string;
  status?: string;
  source?: string;
  notes?: OutputData;
}

export interface UpdateLeadDto {
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  title?: string;
  status?: string;
  notes?: OutputData;
}

export interface LeadFilters {
  page?: number;
  perPage?: number;
  search?: string;
  icpProfileId?: number;
  campaignId?: number;
  status?: string[];
  source?: string[];
}

export const leadsApi = {
  async list(filters: LeadFilters = {}): Promise<LeadsListResponse> {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.perPage) params.set('perPage', String(filters.perPage));
    if (filters.search) params.set('search', filters.search);
    if (filters.icpProfileId)
      params.set('icpProfileId', String(filters.icpProfileId));
    if (filters.campaignId)
      params.set('campaignId', String(filters.campaignId));
    filters.status?.forEach((s) => params.append('status', s));
    filters.source?.forEach((s) => params.append('source', s));
    return apiClient.get(`/leads?${params.toString()}`);
  },

  async get(id: number): Promise<Lead> {
    return apiClient.get(`/leads/${id}`);
  },

  async create(dto: CreateLeadDto): Promise<Lead> {
    return apiClient.post('/leads', dto);
  },

  async update(id: number, dto: UpdateLeadDto): Promise<Lead> {
    return apiClient.patch(`/leads/${id}`, dto);
  },

  async delete(id: number): Promise<void> {
    return apiClient.delete(`/leads/${id}`);
  },

  async convert(id: number) {
    return apiClient.post(`/leads/${id}/convert`, {});
  },

  async getTableViewLeads(filters?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<TableViewLeadsResponse> {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));
    const qs = params.toString();
    return apiClient.get(`/tables/leads${qs ? `?${qs}` : ''}`);
  },
};

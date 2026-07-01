/**
 * ICP (Ideal Customer Profile) API client
 * Type-safe methods for ICP profile operations and Apollo.io data fetching
 */

import { apiClient } from '../api-client';

export interface IcpFilters {
  industries?: string[];
  employeeRanges?: string[];
  revenueRange?: { min?: number; max?: number };
  locations?: string[];
}

export interface IcpProfile {
  id: number;
  organizationId: number;
  name: string;
  description?: Record<string, unknown> | null;
  filters: IcpFilters;
  notes?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIcpProfileDto {
  name: string;
  description?: Record<string, unknown>;
  filters?: IcpFilters;
}

export interface UpdateIcpProfileDto {
  name?: string;
  description?: Record<string, unknown>;
  filters?: IcpFilters;
  notes?: Record<string, unknown>;
}

export interface ApolloOrganization {
  id: string;
  name: string;
  website_url?: string;
  linkedin_url?: string;
  industry?: string;
  estimated_num_employees?: number;
  annual_revenue?: number;
  primary_domain?: string;
  city?: string;
  state?: string;
  country?: string;
  logo_url?: string;
  total_funding?: number;
  latest_funding_amount?: number;
}

export interface ApolloPerson {
  id: string;
  first_name: string;
  last_name_obfuscated: string;
  title: string | null;
  has_email: boolean;
  has_city: boolean;
  has_state: boolean;
  has_country: boolean;
  has_direct_phone: string;
  organization?: {
    name: string;
    has_industry: boolean;
    has_phone: boolean;
    has_city: boolean;
    has_state: boolean;
    has_country: boolean;
    has_zip_code: boolean;
    has_revenue: boolean;
    has_employee_count: boolean;
  };
}

export interface ApolloPagination {
  page: number;
  per_page: number;
  total_entries: number;
  total_pages: number;
}

export interface ApolloCompaniesResponse {
  organizations: ApolloOrganization[];
  pagination: ApolloPagination;
}

export interface ApolloContactsResponse {
  people: ApolloPerson[];
  pagination: ApolloPagination;
}

export interface IcpProfilesPage {
  data: IcpProfile[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export const icpApi = {
  async listProfiles(page = 1, perPage = 20): Promise<IcpProfilesPage> {
    return apiClient.get(`/icps?page=${page}&perPage=${perPage}`);
  },

  async getProfile(id: number): Promise<IcpProfile> {
    return apiClient.get(`/icps/${id}`);
  },

  async createProfile(data: CreateIcpProfileDto): Promise<IcpProfile> {
    return apiClient.post('/icps', data);
  },

  async updateProfile(
    id: number,
    data: UpdateIcpProfileDto,
  ): Promise<IcpProfile> {
    return apiClient.patch(`/icps/${id}`, data);
  },

  async deleteProfile(id: number): Promise<void> {
    return apiClient.delete(`/icps/${id}`);
  },

  async getCompanies(
    id: number,
    page = 1,
    perPage = 25,
  ): Promise<ApolloCompaniesResponse> {
    return apiClient.get(
      `/icps/${id}/companies?page=${page}&perPage=${perPage}`,
    );
  },

  async getContacts(
    id: number,
    page = 1,
    perPage = 25,
  ): Promise<ApolloContactsResponse> {
    return apiClient.get(
      `/icps/${id}/contacts?page=${page}&perPage=${perPage}`,
    );
  },
};

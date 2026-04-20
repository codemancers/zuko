/**
 * Companies API client
 * Type-safe methods for sales companies operations
 */

import { apiClient } from '../api-client';
import type { Contact } from './contacts';
import type { TableViewResponse, PaginationInfo } from '@/types/table-metadata';
import type { BaseRow } from '@/components/Table';
import type { OutputData } from '@editorjs/editorjs';

export interface Company {
  id: number;
  companyName: string;
  website?: string;
  linkedinUrl?: string;
  summary?: OutputData;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  owners: CompanyOwner[];
  contacts?: CompanyContactAssociation[];
  _count?: {
    contacts: number;
  };
}

export interface CompanyOwner {
  id: number;
  userId: number;
  companyId: number;
  isPrimary: boolean;
  assignedAt: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

export interface CompanyContactAssociation {
  id: number;
  companyId: number;
  contactId: number;
  joinedAt: string;
  leftAt?: string;
  role?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  contact: Contact;
}

export interface CompaniesListResponse {
  companies: Company[];
  pagination: PaginationInfo;
}

// Table response uses generic BaseRow to maintain dynamic rendering
export type TableViewCompaniesResponse = TableViewResponse<BaseRow>;

export interface CreateCompanyDto {
  companyName: string;
  website?: string;
  linkedinUrl?: string;
  summary?: OutputData;
  ownerIds?: number[];
  primaryOwnerId?: number;
}

export interface UpdateCompanyDto {
  companyName?: string;
  website?: string;
  linkedinUrl?: string;
  summary?: OutputData;
}

export interface CompanyFilters {
  page?: number;
  limit?: number;
  search?: string;
  ownerIds?: number[];
  isHidden?: boolean;
}

export interface AddContactToCompanyDto {
  contactId: number;
  role?: string;
  isPrimary?: boolean;
  joinedAt?: string;
}

export interface UpdateContactCompanyDto {
  role?: string;
  isPrimary?: boolean;
}

export const companiesApi = {
  /**
   * Get all companies with optional filters
   */
  async getCompanies(filters?: CompanyFilters): Promise<CompaniesListResponse> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, value.toString());
          }
        }
      });
    }

    const queryString = params.toString();
    return apiClient.get(`/companies${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Get companies formatted for table view with metadata
   */
  async getTableViewCompanies(
    filters?: CompanyFilters,
  ): Promise<TableViewCompaniesResponse> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, value.toString());
          }
        }
      });
    }

    const queryString = params.toString();
    return apiClient.get<TableViewCompaniesResponse>(
      `/tables/companies${queryString ? `?${queryString}` : ''}`,
    );
  },

  /**
   * Get a single company by ID
   */
  async getCompany(id: number): Promise<Company> {
    return apiClient.get(`/companies/${id}`);
  },

  /**
   * Create a new company
   */
  async createCompany(data: CreateCompanyDto): Promise<Company> {
    return apiClient.post('/companies', data);
  },

  /**
   * Update an existing company
   */
  async updateCompany(
    id: number,
    data: UpdateCompanyDto,
  ): Promise<Company> {
    return apiClient.patch(`/companies/${id}`, data);
  },

  /**
   * Hide a company (soft delete)
   */
  async hideCompany(id: number): Promise<void> {
    return apiClient.delete(`/companies/${id}`);
  },

  /**
   * Unhide a company
   */
  async unhideCompany(id: number): Promise<Company> {
    return apiClient.post(`/companies/${id}/unhide`);
  },

  /**
   * Add an owner to a company
   */
  async addOwner(
    companyId: number,
    userId: number,
    isPrimary = false,
  ): Promise<CompanyOwner> {
    return apiClient.post(`/companies/${companyId}/owners`, {
      userId,
      isPrimary,
    });
  },

  /**
   * Remove an owner from a company
   */
  async removeOwner(companyId: number, userId: number): Promise<void> {
    return apiClient.delete(`/companies/${companyId}/owners/${userId}`);
  },

  /**
   * Set primary owner for a company
   */
  async setPrimaryOwner(
    companyId: number,
    userId: number,
  ): Promise<{ success: boolean }> {
    return apiClient.post(
      `/companies/${companyId}/owners/${userId}/set-primary`,
    );
  },

  /**
   * Get companies for a specific user
   */
  async getCompaniesByUser(
    userId: number,
    filters?: CompanyFilters,
  ): Promise<CompaniesListResponse> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && key !== 'ownerIds') {
          params.append(key, value.toString());
        }
      });
    }

    const queryString = params.toString();
    return apiClient.get(
      `/companies/user/${userId}${queryString ? `?${queryString}` : ''}`,
    );
  },

  /**
   * Add a contact to a company
   */
  async addContact(
    companyId: number,
    data: AddContactToCompanyDto,
  ): Promise<CompanyContactAssociation> {
    return apiClient.post(`/companies/${companyId}/contacts`, data);
  },

  /**
   * Update a contact-company association
   */
  async updateContact(
    companyId: number,
    contactId: number,
    data: UpdateContactCompanyDto,
  ): Promise<void> {
    return apiClient.patch(
      `/companies/${companyId}/contacts/${contactId}`,
      data,
    );
  },

  /**
   * Remove a contact from a company (sets leftAt)
   */
  async removeContact(companyId: number, contactId: number): Promise<void> {
    return apiClient.delete(`/companies/${companyId}/contacts/${contactId}`);
  },

  /**
   * Get active contacts for a company
   */
  async getActiveContacts(
    companyId: number,
  ): Promise<CompanyContactAssociation[]> {
    return apiClient.get(`/companies/${companyId}/contacts`);
  },

  /**
   * Get all contacts for a company including history
   */
  async getContactHistory(
    companyId: number,
  ): Promise<CompanyContactAssociation[]> {
    return apiClient.get(`/companies/${companyId}/contacts/history`);
  },
};

/**
 * Deals API client
 * Type-safe methods for sales deals operations
 */

import { apiClient } from '../api-client';
import type { Contact } from './contacts';
import type { Company } from './companies';
import type { TableViewResponse, PaginationInfo } from '@/types/table-metadata';
import type { BaseRow } from '@/components/Table';
import type { OutputData } from '@editorjs/editorjs';

export interface Deal {
  id: number;
  title: string;
  value?: number;
  currency?: string;
  probability?: number;
  stage: string;
  summary?: OutputData;
  expectedCloseDate?: string;
  actualCloseDate?: string;
  lostReason?: string;
  source?: string;
  priority?: number;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  owners: DealOwner[];
  companies?: DealCompanyAssociation[];
  contacts?: DealContactAssociation[];
  _count?: {
    companies: number;
    contacts: number;
  };
}

export interface DealOwner {
  id: number;
  userId: number;
  dealId: number;
  isPrimary: boolean;
  assignedAt: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

export interface DealCompanyAssociation {
  id: number;
  dealId: number;
  companyId: number;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  company: Company;
}

export interface DealContactAssociation {
  id: number;
  dealId: number;
  contactId: number;
  role?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  contact: Contact;
}

export interface DealsListResponse {
  deals: Deal[];
  pagination: PaginationInfo;
}

// Table response uses generic BaseRow to maintain dynamic rendering
export type TableViewDealsResponse = TableViewResponse<BaseRow>;

export interface CreateDealDto {
  title: string;
  value?: number;
  currency?: string;
  probability?: number;
  stage?: string;
  summary?: OutputData;
  expectedCloseDate?: string;
  source?: string;
  priority?: number;
  ownerIds?: number[];
  primaryOwnerId?: number;
}

export interface UpdateDealDto {
  title?: string;
  value?: number;
  currency?: string;
  probability?: number;
  stage?: string;
  summary?: OutputData;
  expectedCloseDate?: string;
  actualCloseDate?: string;
  lostReason?: string;
  source?: string;
  priority?: number;
}

export interface DealFilters {
  page?: number;
  limit?: number;
  search?: string;
  ownerIds?: number[];
  companyIds?: number[];
  contactIds?: number[];
  stages?: string[];
  minValue?: number;
  maxValue?: number;
  expectedCloseFrom?: string;
  expectedCloseTo?: string;
  isHidden?: boolean;
}

export interface AddCompanyToDealDto {
  companyId: number;
  isPrimary?: boolean;
}

export interface UpdateDealCompanyDto {
  isPrimary: boolean;
}

export interface AddContactToDealDto {
  contactId: number;
  role?: string;
  isPrimary?: boolean;
}

export interface UpdateDealContactDto {
  role?: string;
  isPrimary?: boolean;
}

export const dealsApi = {
  /**
   * Get all deals with optional filters
   */
  async getDeals(filters?: DealFilters): Promise<DealsListResponse> {
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
    return apiClient.get<DealsListResponse>(
      `/deals${queryString ? `?${queryString}` : ''}`,
    );
  },

  /**
   * Get deals formatted for table view with metadata
   */
  async getTableViewDeals(
    filters?: DealFilters,
  ): Promise<TableViewDealsResponse> {
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
    return apiClient.get<TableViewDealsResponse>(
      `/tables/deals${queryString ? `?${queryString}` : ''}`,
    );
  },

  /**
   * Get a single deal by ID
   */
  async getDeal(id: number): Promise<Deal> {
    return apiClient.get<Deal>(`/deals/${id}`);
  },

  /**
   * Create a new deal
   */
  async createDeal(data: CreateDealDto): Promise<Deal> {
    return apiClient.post('/deals', data);
  },

  /**
   * Update an existing deal
   */
  async updateDeal(id: number, data: UpdateDealDto): Promise<Deal> {
    return apiClient.patch(`/deals/${id}`, data);
  },

  /**
   * Hide a deal (soft delete)
   */
  async hideDeal(id: number): Promise<void> {
    return apiClient.delete(`/deals/${id}`);
  },

  /**
   * Unhide a deal
   */
  async unhideDeal(id: number): Promise<Deal> {
    return apiClient.post(`/deals/${id}/unhide`);
  },

  /**
   * Add an owner to a deal
   */
  async addOwner(
    dealId: number,
    userId: number,
    isPrimary = false,
  ): Promise<DealOwner> {
    return apiClient.post(`/deals/${dealId}/owners`, { userId, isPrimary });
  },

  /**
   * Remove an owner from a deal
   */
  async removeOwner(dealId: number, userId: number): Promise<void> {
    return apiClient.delete(`/deals/${dealId}/owners/${userId}`);
  },

  /**
   * Set primary owner for a deal
   */
  async setPrimaryOwner(
    dealId: number,
    userId: number,
  ): Promise<{ success: boolean }> {
    return apiClient.post(`/deals/${dealId}/owners/${userId}/set-primary`);
  },

  /**
   * Get deals for a specific user
   */
  async getDealsByUser(
    userId: number,
    filters?: DealFilters,
  ): Promise<DealsListResponse> {
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
      `/deals/user/${userId}${queryString ? `?${queryString}` : ''}`,
    );
  },

  /**
   * Add a company to a deal
   */
  async addCompany(
    dealId: number,
    data: AddCompanyToDealDto,
  ): Promise<DealCompanyAssociation> {
    return apiClient.post(`/deals/${dealId}/companies`, data);
  },

  /**
   * Update a deal-company association
   */
  async updateCompany(
    dealId: number,
    companyId: number,
    data: UpdateDealCompanyDto,
  ): Promise<void> {
    return apiClient.patch(`/deals/${dealId}/companies/${companyId}`, data);
  },

  /**
   * Remove a company from a deal
   */
  async removeCompany(dealId: number, companyId: number): Promise<void> {
    return apiClient.delete(`/deals/${dealId}/companies/${companyId}`);
  },

  /**
   * Get companies for a deal
   */
  async getCompanies(dealId: number): Promise<DealCompanyAssociation[]> {
    const list = await apiClient.get<DealCompanyAssociation[]>(
      `/deals/${dealId}/companies`,
    );
    return Array.isArray(list) ? list : [];
  },

  /**
   * Add a contact to a deal
   */
  async addContact(
    dealId: number,
    data: AddContactToDealDto,
  ): Promise<DealContactAssociation> {
    return apiClient.post(`/deals/${dealId}/contacts`, data);
  },

  /**
   * Update a deal-contact association
   */
  async updateContact(
    dealId: number,
    contactId: number,
    data: UpdateDealContactDto,
  ): Promise<void> {
    return apiClient.patch(`/deals/${dealId}/contacts/${contactId}`, data);
  },

  /**
   * Remove a contact from a deal
   */
  async removeContact(dealId: number, contactId: number): Promise<void> {
    return apiClient.delete(`/deals/${dealId}/contacts/${contactId}`);
  },

  /**
   * Get contacts for a deal
   */
  async getContacts(dealId: number): Promise<DealContactAssociation[]> {
    return apiClient.get(`/deals/${dealId}/contacts`);
  },

  /**
   * Get deals for a specific company
   */
  async getDealsByCompany(
    companyId: number,
    filters?: DealFilters,
  ): Promise<DealsListResponse> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && key !== 'companyIds') {
          params.append(key, value.toString());
        }
      });
    }

    const queryString = params.toString();
    return apiClient.get(
      `/deals/company/${companyId}${queryString ? `?${queryString}` : ''}`,
    );
  },

  /**
   * Get deals for a specific contact
   */
  async getDealsByContact(
    contactId: number,
    filters?: DealFilters,
  ): Promise<DealsListResponse> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && key !== 'contactIds') {
          params.append(key, value.toString());
        }
      });
    }

    const queryString = params.toString();
    return apiClient.get(
      `/deals/contact/${contactId}${queryString ? `?${queryString}` : ''}`,
    );
  },
};

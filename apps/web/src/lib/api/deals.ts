/**
 * Deals API client
 * Type-safe methods for sales deals operations
 */

import { apiClient } from '../api-client';
import type { Contact } from './contacts';
import type { SalesAccount } from './accounts';

export interface Deal {
  id: number;
  title: string;
  value?: number;
  currency?: string;
  probability?: number;
  stage: string;
  summary?: string;
  expectedCloseDate?: string;
  actualCloseDate?: string;
  lostReason?: string;
  source?: string;
  priority?: number;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  owners: DealOwner[];
  accounts?: DealAccountAssociation[];
  contacts?: DealContactAssociation[];
  _count?: {
    accounts: number;
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

export interface DealAccountAssociation {
  id: number;
  dealId: number;
  accountId: number;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  account: SalesAccount;
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
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateDealDto {
  title: string;
  value?: number;
  currency?: string;
  probability?: number;
  stage?: string;
  summary?: string;
  expectedCloseDate?: string;
  source?: string;
  priority?: number;
  ownerIds: number[];
  primaryOwnerId?: number;
}

export interface UpdateDealDto {
  title?: string;
  value?: number;
  currency?: string;
  probability?: number;
  stage?: string;
  summary?: string;
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
  accountIds?: number[];
  contactIds?: number[];
  stages?: string[];
  minValue?: number;
  maxValue?: number;
  expectedCloseFrom?: string;
  expectedCloseTo?: string;
  isHidden?: boolean;
}

export interface AddAccountToDealDto {
  accountId: number;
  isPrimary?: boolean;
}

export interface UpdateDealAccountDto {
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
    return apiClient.get(`/deals${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Get a single deal by ID
   */
  async getDeal(id: number): Promise<Deal> {
    return apiClient.get(`/deals/${id}`);
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
  async addOwner(dealId: number, userId: number, isPrimary = false): Promise<DealOwner> {
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
  async setPrimaryOwner(dealId: number, userId: number): Promise<{ success: boolean }> {
    return apiClient.post(`/deals/${dealId}/owners/${userId}/set-primary`);
  },

  /**
   * Get deals for a specific user
   */
  async getDealsByUser(userId: number, filters?: DealFilters): Promise<DealsListResponse> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && key !== 'ownerIds') {
          params.append(key, value.toString());
        }
      });
    }

    const queryString = params.toString();
    return apiClient.get(`/deals/user/${userId}${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Add an account to a deal
   */
  async addAccount(
    dealId: number,
    data: AddAccountToDealDto
  ): Promise<DealAccountAssociation> {
    return apiClient.post(`/deals/${dealId}/accounts`, data);
  },

  /**
   * Update a deal-account association
   */
  async updateAccount(
    dealId: number,
    accountId: number,
    data: UpdateDealAccountDto
  ): Promise<void> {
    return apiClient.patch(`/deals/${dealId}/accounts/${accountId}`, data);
  },

  /**
   * Remove an account from a deal
   */
  async removeAccount(dealId: number, accountId: number): Promise<void> {
    return apiClient.delete(`/deals/${dealId}/accounts/${accountId}`);
  },

  /**
   * Get accounts for a deal
   */
  async getAccounts(dealId: number): Promise<DealAccountAssociation[]> {
    return apiClient.get(`/deals/${dealId}/accounts`);
  },

  /**
   * Add a contact to a deal
   */
  async addContact(
    dealId: number,
    data: AddContactToDealDto
  ): Promise<DealContactAssociation> {
    return apiClient.post(`/deals/${dealId}/contacts`, data);
  },

  /**
   * Update a deal-contact association
   */
  async updateContact(
    dealId: number,
    contactId: number,
    data: UpdateDealContactDto
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
   * Get deals for a specific account
   */
  async getDealsByAccount(accountId: number, filters?: DealFilters): Promise<DealsListResponse> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && key !== 'accountIds') {
          params.append(key, value.toString());
        }
      });
    }

    const queryString = params.toString();
    return apiClient.get(`/deals/account/${accountId}${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Get deals for a specific contact
   */
  async getDealsByContact(contactId: number, filters?: DealFilters): Promise<DealsListResponse> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && key !== 'contactIds') {
          params.append(key, value.toString());
        }
      });
    }

    const queryString = params.toString();
    return apiClient.get(`/deals/contact/${contactId}${queryString ? `?${queryString}` : ''}`);
  },
};

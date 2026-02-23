/**
 * Accounts API client
 * Type-safe methods for sales accounts operations
 */

import { apiClient } from '../api-client';
import type { Contact } from './contacts';

export interface SalesAccount {
  id: number;
  companyName: string;
  website?: string;
  linkedinUrl?: string;
  summary?: string;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  owners: AccountOwner[];
  contacts?: AccountContactAssociation[];
  _count?: {
    contacts: number;
  };
}

export interface AccountOwner {
  id: number;
  userId: number;
  accountId: number;
  isPrimary: boolean;
  assignedAt: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

export interface AccountContactAssociation {
  id: number;
  accountId: number;
  contactId: number;
  joinedAt: string;
  leftAt?: string;
  role?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  contact: Contact;
}

export interface AccountsListResponse {
  accounts: SalesAccount[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateAccountDto {
  companyName: string;
  website?: string;
  linkedinUrl?: string;
  summary?: string;
  ownerIds: number[];
  primaryOwnerId?: number;
}

export interface UpdateAccountDto {
  companyName?: string;
  website?: string;
  linkedinUrl?: string;
  summary?: string;
}

export interface AccountFilters {
  page?: number;
  limit?: number;
  search?: string;
  ownerIds?: number[];
  isHidden?: boolean;
}

export interface AddContactToAccountDto {
  contactId: number;
  role?: string;
  isPrimary?: boolean;
  joinedAt?: string;
}

export interface UpdateContactAccountDto {
  role?: string;
  isPrimary?: boolean;
}

export const accountsApi = {
  /**
   * Get all accounts with optional filters
   */
  async getAccounts(filters?: AccountFilters): Promise<AccountsListResponse> {
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
    return apiClient.get(`/accounts${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Get a single account by ID
   */
  async getAccount(id: number): Promise<SalesAccount> {
    return apiClient.get(`/accounts/${id}`);
  },

  /**
   * Create a new account
   */
  async createAccount(data: CreateAccountDto): Promise<SalesAccount> {
    return apiClient.post('/accounts', data);
  },

  /**
   * Update an existing account
   */
  async updateAccount(id: number, data: UpdateAccountDto): Promise<SalesAccount> {
    return apiClient.patch(`/accounts/${id}`, data);
  },

  /**
   * Hide an account (soft delete)
   */
  async hideAccount(id: number): Promise<void> {
    return apiClient.delete(`/accounts/${id}`);
  },

  /**
   * Unhide an account
   */
  async unhideAccount(id: number): Promise<SalesAccount> {
    return apiClient.post(`/accounts/${id}/unhide`);
  },

  /**
   * Add an owner to an account
   */
  async addOwner(accountId: number, userId: number, isPrimary = false): Promise<AccountOwner> {
    return apiClient.post(`/accounts/${accountId}/owners`, { userId, isPrimary });
  },

  /**
   * Remove an owner from an account
   */
  async removeOwner(accountId: number, userId: number): Promise<void> {
    return apiClient.delete(`/accounts/${accountId}/owners/${userId}`);
  },

  /**
   * Set primary owner for an account
   */
  async setPrimaryOwner(accountId: number, userId: number): Promise<{ success: boolean }> {
    return apiClient.post(`/accounts/${accountId}/owners/${userId}/set-primary`);
  },

  /**
   * Get accounts for a specific user
   */
  async getAccountsByUser(userId: number, filters?: AccountFilters): Promise<AccountsListResponse> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && key !== 'ownerIds') {
          params.append(key, value.toString());
        }
      });
    }

    const queryString = params.toString();
    return apiClient.get(`/accounts/user/${userId}${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Add a contact to an account
   */
  async addContact(
    accountId: number,
    data: AddContactToAccountDto
  ): Promise<AccountContactAssociation> {
    return apiClient.post(`/accounts/${accountId}/contacts`, data);
  },

  /**
   * Update a contact-account association
   */
  async updateContact(
    accountId: number,
    contactId: number,
    data: UpdateContactAccountDto
  ): Promise<void> {
    return apiClient.patch(`/accounts/${accountId}/contacts/${contactId}`, data);
  },

  /**
   * Remove a contact from an account (sets leftAt)
   */
  async removeContact(accountId: number, contactId: number): Promise<void> {
    return apiClient.delete(`/accounts/${accountId}/contacts/${contactId}`);
  },

  /**
   * Get active contacts for an account
   */
  async getActiveContacts(accountId: number): Promise<AccountContactAssociation[]> {
    return apiClient.get(`/accounts/${accountId}/contacts`);
  },

  /**
   * Get all contacts for an account including history
   */
  async getContactHistory(accountId: number): Promise<AccountContactAssociation[]> {
    return apiClient.get(`/accounts/${accountId}/contacts/history`);
  },
};

/**
 * Contacts API client
 * Type-safe methods for contacts operations
 */

import { apiClient } from '../api-client';

export interface Contact {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  linkedinId?: string;
  notes?: string;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  owners: ContactOwner[];
}

export interface ContactOwner {
  id: number;
  userId: number;
  contactId: number;
  isPrimary: boolean;
  assignedAt: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

export interface ContactsListResponse {
  contacts: Contact[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateContactDto {
  name: string;
  email?: string;
  phone?: string;
  linkedinId?: string;
  notes?: string;
  ownerIds: number[];
  primaryOwnerId?: number;
}

export interface UpdateContactDto {
  name?: string;
  email?: string;
  phone?: string;
  linkedinId?: string;
  notes?: string;
}

export interface ContactFilters {
  page?: number;
  limit?: number;
  search?: string;
  ownerIds?: number[];
  isHidden?: boolean;
}

export const contactsApi = {
  /**
   * Get all contacts with optional filters
   */
  async getContacts(filters?: ContactFilters): Promise<ContactsListResponse> {
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
    return apiClient.get(`/contacts${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Get a single contact by ID
   */
  async getContact(id: number): Promise<Contact> {
    return apiClient.get(`/contacts/${id}`);
  },

  /**
   * Create a new contact
   */
  async createContact(data: CreateContactDto): Promise<Contact> {
    return apiClient.post('/contacts', data);
  },

  /**
   * Update an existing contact
   */
  async updateContact(id: number, data: UpdateContactDto): Promise<Contact> {
    return apiClient.patch(`/contacts/${id}`, data);
  },

  /**
   * Hide a contact (soft delete)
   */
  async hideContact(id: number): Promise<void> {
    return apiClient.delete(`/contacts/${id}`);
  },

  /**
   * Unhide a contact
   */
  async unhideContact(id: number): Promise<Contact> {
    return apiClient.post(`/contacts/${id}/unhide`);
  },

  /**
   * Add an owner to a contact
   */
  async addOwner(contactId: number, userId: number, isPrimary = false): Promise<ContactOwner> {
    return apiClient.post(`/contacts/${contactId}/owners`, { userId, isPrimary });
  },

  /**
   * Remove an owner from a contact
   */
  async removeOwner(contactId: number, userId: number): Promise<void> {
    return apiClient.delete(`/contacts/${contactId}/owners/${userId}`);
  },

  /**
   * Set primary owner for a contact
   */
  async setPrimaryOwner(contactId: number, userId: number): Promise<{ success: boolean }> {
    return apiClient.post(`/contacts/${contactId}/owners/${userId}/set-primary`);
  },

  /**
   * Get contacts for a specific user
   */
  async getContactsByUser(userId: number, filters?: ContactFilters): Promise<ContactsListResponse> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && key !== 'ownerIds') {
          params.append(key, value.toString());
        }
      });
    }

    const queryString = params.toString();
    return apiClient.get(`/contacts/user/${userId}${queryString ? `?${queryString}` : ''}`);
  },
};

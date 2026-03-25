import { Contact, Company, User, ContactOwner, CompanyOwner, Deal } from '@prisma/client';

/**
 * Shared interface for dynamic JSON fields in CRM entities.
 */
export interface CustomFields {
  [key: string]: unknown;
}

/**
 * Contact with related owners and their user details.
 */
export type ContactWithOwners = Contact & {
  owners?: (ContactOwner & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

/**
 * Company with related owners and relation counts.
 */
export type CompanyWithDetails = Company & {
  owners?: (CompanyOwner & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
  _count?: {
    contacts?: number;
    deals?: number;
  };
};

/**
 * Flattened API response type for Contacts.
 */
export type FlattenedContact = Omit<ContactWithOwners, 'fields'> & CustomFields;

/**
 * Flattened API response type for Companies.
 */
export type FlattenedCompany = Omit<CompanyWithDetails, 'fields'> & CustomFields;

/**
 * Flattened API response type for Companies.
 */
export type FlattenedDeal = Omit<Deal, 'fields'> & CustomFields;

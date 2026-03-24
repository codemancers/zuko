import type { ActivitySource } from './deal-events';

export const COMPANY_EVENTS = {
  CREATED: 'company.created',
  FIELD_UPDATED: 'company.field_updated',
  OWNER_ASSIGNED: 'company.owner_assigned',
  OWNER_REMOVED: 'company.owner_removed',
  CONTACT_LINKED: 'company.contact_linked',
  CONTACT_UNLINKED: 'company.contact_unlinked',
} as const;

interface CompanyEventBase {
  companyId: number;
  actorId?: number;
  source?: ActivitySource;
}

export type CompanyCreatedEvent = CompanyEventBase;

export interface CompanyFieldUpdatedEvent extends CompanyEventBase {
  field: string;
  from: unknown;
  to: unknown;
}

export interface CompanyOwnerAssignedEvent extends CompanyEventBase {
  userId: number;
  userName: string;
}

export interface CompanyOwnerRemovedEvent extends CompanyEventBase {
  userId: number;
  userName: string;
}

export interface CompanyContactLinkedEvent extends CompanyEventBase {
  contactId: number;
  contactName: string;
  role?: string;
}

export interface CompanyContactUnlinkedEvent extends CompanyEventBase {
  contactId: number;
  contactName: string;
}

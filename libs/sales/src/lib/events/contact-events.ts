import type { ActivitySource } from './deal-events';

export const CONTACT_EVENTS = {
  CREATED: 'contact.created',
  FIELD_UPDATED: 'contact.field_updated',
  OWNER_ASSIGNED: 'contact.owner_assigned',
  OWNER_REMOVED: 'contact.owner_removed',
} as const;

interface ContactEventBase {
  contactId: number;
  actorId?: number;
  source?: ActivitySource;
}

export interface ContactCreatedEvent extends ContactEventBase {}

export interface ContactFieldUpdatedEvent extends ContactEventBase {
  field: string;
  from: unknown;
  to: unknown;
}

export interface ContactOwnerAssignedEvent extends ContactEventBase {
  userId: number;
  userName: string;
}

export interface ContactOwnerRemovedEvent extends ContactEventBase {
  userId: number;
  userName: string;
}

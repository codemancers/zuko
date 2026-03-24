export const ACTIVITY_SOURCES = {
  AI: 'ai',
} as const;

export type ActivitySource = typeof ACTIVITY_SOURCES[keyof typeof ACTIVITY_SOURCES];

export const DEAL_EVENTS = {
  CREATED: 'deal.created',
  STAGE_CHANGED: 'deal.stage_changed',
  CLOSED: 'deal.closed',
  FIELD_UPDATED: 'deal.field_updated',
  OWNER_ASSIGNED: 'deal.owner_assigned',
  OWNER_REMOVED: 'deal.owner_removed',
  COMPANY_LINKED: 'deal.company_linked',
  COMPANY_UNLINKED: 'deal.company_unlinked',
  CONTACT_LINKED: 'deal.contact_linked',
  CONTACT_UNLINKED: 'deal.contact_unlinked',
} as const;

interface DealEventBase {
  dealId: number;
  actorId?: number;
  source?: ActivitySource;
}

export type DealCreatedEvent = DealEventBase;

export interface DealStageChangedEvent extends DealEventBase {
  from: string;
  to: string;
}

export interface DealClosedEvent extends DealEventBase {
  outcome: 'won' | 'lost';
  lostReason?: string;
}

export interface DealFieldUpdatedEvent extends DealEventBase {
  field: string;
  from: unknown;
  to: unknown;
}

export interface DealOwnerAssignedEvent extends DealEventBase {
  userId: number;
  userName: string;
}

export interface DealOwnerRemovedEvent extends DealEventBase {
  userId: number;
  userName: string;
}

export interface DealCompanyLinkedEvent extends DealEventBase {
  companyId: number;
  companyName: string;
}

export interface DealCompanyUnlinkedEvent extends DealEventBase {
  companyId: number;
  companyName: string;
}

export interface DealContactLinkedEvent extends DealEventBase {
  contactId: number;
  contactName: string;
  role?: string;
}

export interface DealContactUnlinkedEvent extends DealEventBase {
  contactId: number;
  contactName: string;
}

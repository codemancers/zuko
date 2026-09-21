import type { ActivitySource } from './deal-events';

export const LEAD_EVENTS = {
  CREATED: 'lead.created',
  CONVERTED: 'lead.converted',
  REVERTED: 'lead.reverted',
} as const;

interface LeadEventBase {
  leadId: number;
  actorId?: number;
  source?: ActivitySource;
}

export interface LeadCreatedEvent extends LeadEventBase {
  /** Set when the lead came from a promoted prospect rather than by hand. */
  prospectId?: number;
}

export interface LeadConvertedEvent extends LeadEventBase {
  dealId: number;
  contactId?: number;
  companyId?: number;
}

export interface LeadRevertedEvent extends LeadEventBase {
  dealId?: number;
}

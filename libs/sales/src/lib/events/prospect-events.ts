import type { ActivitySource } from './deal-events';

export const PROSPECT_EVENTS = {
  CREATED: 'prospect.created',
  STATUS_CHANGED: 'prospect.status_changed',
  ENROLLED: 'prospect.enrolled',
  PROMOTED: 'prospect.promoted',
  DEMOTED: 'prospect.demoted',
  CONSENT_CHANGED: 'prospect.consent_changed',
  SUPPRESSED: 'prospect.suppressed',
} as const;

interface ProspectEventBase {
  prospectId: number;
  actorId?: number;
  source?: ActivitySource;
}

export type ProspectCreatedEvent = ProspectEventBase;

export interface ProspectStatusChangedEvent extends ProspectEventBase {
  from: string;
  to: string;
}

export interface ProspectEnrolledEvent extends ProspectEventBase {
  campaignId: number;
  campaignName?: string;
  channel: string;
}

export interface ProspectPromotedEvent extends ProspectEventBase {
  leadId: number;
}

export interface ProspectDemotedEvent extends ProspectEventBase {
  leadId: number;
}

export interface ProspectConsentChangedEvent extends ProspectEventBase {
  channel: string;
  from: string;
  to: string;
}

export type ProspectSuppressedEvent = ProspectEventBase;

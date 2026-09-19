/**
 * Prospect lifecycle — the single source of truth for prospect standing,
 * campaign membership states, engagement states, dispositions, the events that
 * drive them, and the transitions allowed between them.
 *
 * Three axes describe a membership, and they are independent:
 *   - campaign state   — where the prospect is in the campaign's mechanics
 *   - engagement state — how the prospect has responded
 *   - disposition      — what we concluded about them
 *
 * Events are separate from all three: an event is something that happened,
 * a state is what is true now. Events drive transitions; states are the result.
 *
 * Terminology and rationale: docs/concepts/prospect-lifecycle.mdx
 */

// ============================================
// PROSPECT STATUS (org-level standing)
// ============================================

export const PROSPECT_STATUSES = [
  { label: 'New', value: 'new' },
  { label: 'Enrolled', value: 'enrolled' },
  { label: 'Engaged', value: 'engaged' },
  { label: 'Promoted', value: 'promoted' },
  { label: 'Disqualified', value: 'disqualified' },
  { label: 'Suppressed', value: 'suppressed' },
] as const;

export type ProspectStatus = (typeof PROSPECT_STATUSES)[number]['value'];

export const PROSPECT_STATUS_VALUES: string[] = PROSPECT_STATUSES.map(
  (s) => s.value as string,
);

export const PROSPECT_STATUS_COLORS: Record<ProspectStatus, string> = {
  new: 'zinc',
  enrolled: 'blue',
  engaged: 'green',
  promoted: 'yellow',
  disqualified: 'orange',
  suppressed: 'red',
};

/**
 * Allowed prospect status transitions. A status is never its own successor —
 * re-entering the same status is a no-op, not a transition.
 */
export const PROSPECT_STATUS_TRANSITIONS: Record<
  ProspectStatus,
  readonly ProspectStatus[]
> = {
  // `engaged` is reachable directly: a rep can call someone who is in no
  // campaign at all and get a response. Requiring `enrolled` first would
  // assume every conversation starts in a sequence.
  new: ['enrolled', 'engaged', 'disqualified', 'suppressed'],
  enrolled: ['new', 'engaged', 'disqualified', 'suppressed'],
  engaged: ['enrolled', 'promoted', 'disqualified', 'suppressed'],
  promoted: ['engaged', 'disqualified', 'suppressed'],
  // Suppression is a compliance state: reachable from everywhere, including
  // from disqualified, and only leavable on fresh consent.
  disqualified: ['new', 'suppressed'],
  suppressed: ['new'],
};

/**
 * Transitions that may only happen on an explicit, recorded operator action —
 * never as a side effect of campaign activity. Leaving suppression requires
 * fresh consent; reviving a disqualified prospect requires a human decision.
 */
export const MANUAL_ONLY_PROSPECT_TRANSITIONS: readonly (readonly [
  ProspectStatus,
  ProspectStatus,
])[] = [
  ['suppressed', 'new'],
  ['disqualified', 'new'],
];

export interface ProspectTransitionOptions {
  /** True when the transition is driven by an explicit operator action. */
  manual?: boolean;
}

export function isProspectStatus(value: string): value is ProspectStatus {
  return PROSPECT_STATUS_VALUES.includes(value);
}

export function canTransitionProspect(
  from: ProspectStatus,
  to: ProspectStatus,
  options: ProspectTransitionOptions = {},
): boolean {
  if (!PROSPECT_STATUS_TRANSITIONS[from]?.includes(to)) return false;

  const manualOnly = MANUAL_ONLY_PROSPECT_TRANSITIONS.some(
    ([f, t]) => f === from && t === to,
  );

  return manualOnly ? options.manual === true : true;
}

/** Statuses a prospect may be enrolled into a campaign from. */
export const ENROLLABLE_PROSPECT_STATUSES: readonly ProspectStatus[] = [
  'new',
  'enrolled',
];

export function canEnrollProspect(status: ProspectStatus): boolean {
  return ENROLLABLE_PROSPECT_STATUSES.includes(status);
}

/** Statuses a prospect may be promoted to a lead from. */
export function isPromotableProspect(status: ProspectStatus): boolean {
  return status === 'engaged';
}

// ============================================
// CAMPAIGN MEMBERSHIP STATE (campaign mechanics)
// ============================================

export const CAMPAIGN_MEMBERSHIP_STATES = [
  { label: 'Identified', value: 'identified' },
  { label: 'Enrolled', value: 'enrolled' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Removed', value: 'removed' },
] as const;

export type CampaignMembershipState =
  (typeof CAMPAIGN_MEMBERSHIP_STATES)[number]['value'];

export const CAMPAIGN_MEMBERSHIP_STATE_VALUES: string[] =
  CAMPAIGN_MEMBERSHIP_STATES.map((s) => s.value as string);

export const CAMPAIGN_MEMBERSHIP_STATE_COLORS: Record<
  CampaignMembershipState,
  string
> = {
  identified: 'zinc',
  enrolled: 'blue',
  active: 'green',
  completed: 'purple',
  removed: 'red',
};

/** States in which the campaign still owns the prospect. */
export const OPEN_MEMBERSHIP_STATES: readonly CampaignMembershipState[] = [
  'identified',
  'enrolled',
  'active',
];

/** End states — a membership here is closed and carries a disposition. */
export const TERMINAL_MEMBERSHIP_STATES: readonly CampaignMembershipState[] = [
  'completed',
  'removed',
];

export const CAMPAIGN_MEMBERSHIP_TRANSITIONS: Record<
  CampaignMembershipState,
  readonly CampaignMembershipState[]
> = {
  identified: ['enrolled', 'removed'],
  enrolled: ['active', 'removed'],
  active: ['completed', 'removed'],
  completed: [],
  removed: [],
};

export function isCampaignMembershipState(
  value: string,
): value is CampaignMembershipState {
  return CAMPAIGN_MEMBERSHIP_STATE_VALUES.includes(value);
}

export function isOpenMembershipState(state: CampaignMembershipState): boolean {
  return OPEN_MEMBERSHIP_STATES.includes(state);
}

export function isTerminalMembershipState(
  state: CampaignMembershipState,
): boolean {
  return TERMINAL_MEMBERSHIP_STATES.includes(state);
}

/** A closed membership must record what we concluded. */
export function requiresDisposition(state: CampaignMembershipState): boolean {
  return isTerminalMembershipState(state);
}

export function canTransitionMembership(
  from: CampaignMembershipState,
  to: CampaignMembershipState,
): boolean {
  return CAMPAIGN_MEMBERSHIP_TRANSITIONS[from]?.includes(to) ?? false;
}

// ============================================
// ENGAGEMENT STATE (how the prospect responded)
// ============================================

export const ENGAGEMENT_STATES = [
  { label: 'Not Contacted', value: 'not_contacted' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Responded', value: 'responded' },
  { label: 'No Response', value: 'no_response' },
  { label: 'Unreachable', value: 'unreachable' },
] as const;

export type EngagementState = (typeof ENGAGEMENT_STATES)[number]['value'];

export const ENGAGEMENT_STATE_VALUES: string[] = ENGAGEMENT_STATES.map(
  (s) => s.value as string,
);

export const ENGAGEMENT_STATE_COLORS: Record<EngagementState, string> = {
  not_contacted: 'zinc',
  contacted: 'blue',
  responded: 'green',
  no_response: 'amber',
  unreachable: 'red',
};

export const ENGAGEMENT_TRANSITIONS: Record<
  EngagementState,
  readonly EngagementState[]
> = {
  not_contacted: ['contacted', 'unreachable'],
  contacted: ['responded', 'no_response', 'unreachable'],
  // A late reply after the sequence ended still counts as a response.
  no_response: ['responded'],
  responded: [],
  unreachable: [],
};

export function isEngagementState(value: string): value is EngagementState {
  return ENGAGEMENT_STATE_VALUES.includes(value);
}

export function canTransitionEngagement(
  from: EngagementState,
  to: EngagementState,
): boolean {
  return ENGAGEMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

/** The recipient answered — the signal that drives promotion. */
export function isPositiveEngagement(state: EngagementState): boolean {
  return state === 'responded';
}

// ============================================
// DISPOSITION (what we concluded)
// ============================================

export const CAMPAIGN_DISPOSITIONS = [
  { label: 'Interested', value: 'interested' },
  { label: 'Nurture', value: 'nurture' },
  { label: 'Disqualified', value: 'disqualified' },
  { label: 'Opted Out', value: 'opted_out' },
] as const;

export type CampaignDisposition =
  (typeof CAMPAIGN_DISPOSITIONS)[number]['value'];

export const CAMPAIGN_DISPOSITION_VALUES: string[] = CAMPAIGN_DISPOSITIONS.map(
  (d) => d.value as string,
);

export const CAMPAIGN_DISPOSITION_COLORS: Record<CampaignDisposition, string> =
  {
    interested: 'green',
    nurture: 'blue',
    disqualified: 'orange',
    opted_out: 'red',
  };

/**
 * The prospect standing each disposition implies once a membership closes.
 * `nurture` returns the prospect to the pool — a later campaign may try again.
 */
export const DISPOSITION_TO_PROSPECT_STATUS: Record<
  CampaignDisposition,
  ProspectStatus
> = {
  interested: 'engaged',
  nurture: 'new',
  disqualified: 'disqualified',
  opted_out: 'suppressed',
};

export function isCampaignDisposition(
  value: string,
): value is CampaignDisposition {
  return CAMPAIGN_DISPOSITION_VALUES.includes(value);
}

export function prospectStatusForDisposition(
  disposition: CampaignDisposition,
): ProspectStatus {
  return DISPOSITION_TO_PROSPECT_STATUS[disposition];
}

/** Only `interested` puts a prospect on the promotion path. */
export function isPositiveDisposition(
  disposition: CampaignDisposition,
): boolean {
  return disposition === 'interested';
}

// ============================================
// CAMPAIGN EVENTS (what happened)
// ============================================

export const CAMPAIGN_EVENTS = [
  { label: 'Enrolled', value: 'enrolled' },

  // Email
  { label: 'Email Sent', value: 'email_sent' },
  { label: 'Email Delivered', value: 'email_delivered' },
  { label: 'Email Opened', value: 'email_opened' },
  { label: 'Email Clicked', value: 'email_clicked' },
  { label: 'Email Bounced', value: 'email_bounced' },

  // Phone — a call has outcomes an email does not, and flattening them into
  // "delivered" would throw away what the rep actually learned.
  { label: 'Call Placed', value: 'call_placed' },
  { label: 'Call Connected', value: 'call_connected' },
  { label: 'Voicemail Left', value: 'voicemail_left' },
  { label: 'No Answer', value: 'call_no_answer' },
  { label: 'Call Failed', value: 'call_failed' },

  // LinkedIn
  { label: 'Connection Requested', value: 'connection_requested' },
  { label: 'Connection Accepted', value: 'connection_accepted' },
  { label: 'Message Sent', value: 'linkedin_message_sent' },

  // Channel-neutral — a callback and an email reply are both replies.
  { label: 'Reply Received', value: 'reply_received' },
  { label: 'Meeting Booked', value: 'meeting_booked' },
  { label: 'Opted Out', value: 'opted_out' },
  { label: 'Sequence Finished', value: 'sequence_finished' },
  { label: 'Removed', value: 'removed' },
] as const;

export type CampaignEvent = (typeof CAMPAIGN_EVENTS)[number]['value'];

export const CAMPAIGN_EVENT_VALUES: string[] = CAMPAIGN_EVENTS.map(
  (e) => e.value as string,
);

/** Which channel an event can occur on. Null means any. */
export const EVENT_CHANNEL: Partial<Record<CampaignEvent, ContactChannel>> = {
  email_sent: 'email',
  email_delivered: 'email',
  email_opened: 'email',
  email_clicked: 'email',
  email_bounced: 'email',
  call_placed: 'phone',
  call_connected: 'phone',
  voicemail_left: 'phone',
  call_no_answer: 'phone',
  call_failed: 'phone',
  connection_requested: 'linkedin',
  connection_accepted: 'linkedin',
  linkedin_message_sent: 'linkedin',
};

/** Touches the prospect initiated, rather than ones we sent. */
export const INBOUND_EVENTS: readonly CampaignEvent[] = [
  'reply_received',
  'meeting_booked',
  'opted_out',
  'connection_accepted',
];

export interface CampaignEventEffect {
  /** Campaign state the event moves the membership to, if any. */
  membershipState?: CampaignMembershipState;
  /** Engagement state the event moves the membership to, if any. */
  engagementState?: EngagementState;
  /** Disposition the event settles on, if any. */
  disposition?: CampaignDisposition;
}

/**
 * How each event lands on the three axes. An empty effect is deliberate:
 * opens, clicks and unanswered dials are worth storing and scoring, but they
 * do not change what is true about the prospect — only a response does.
 */
export const CAMPAIGN_EVENT_EFFECTS: Record<
  CampaignEvent,
  CampaignEventEffect
> = {
  enrolled: { membershipState: 'enrolled' },

  email_sent: { membershipState: 'active' },
  email_delivered: { engagementState: 'contacted' },
  email_opened: {},
  email_clicked: {},
  email_bounced: {
    membershipState: 'removed',
    engagementState: 'unreachable',
    disposition: 'disqualified',
  },

  call_placed: { membershipState: 'active' },
  // Reaching a human is contact; reaching their voicemail is still contact.
  call_connected: { engagementState: 'contacted' },
  voicemail_left: { engagementState: 'contacted' },
  // A dial nobody picked up tells us nothing about them.
  call_no_answer: {},
  // Disconnected or wrong number — the equivalent of a hard bounce.
  call_failed: {
    membershipState: 'removed',
    engagementState: 'unreachable',
    disposition: 'disqualified',
  },

  connection_requested: { membershipState: 'active' },
  connection_accepted: { engagementState: 'contacted' },
  linkedin_message_sent: { engagementState: 'contacted' },

  reply_received: { engagementState: 'responded' },
  meeting_booked: {
    engagementState: 'responded',
    disposition: 'interested',
  },
  opted_out: {
    membershipState: 'removed',
    disposition: 'opted_out',
  },
  sequence_finished: {
    membershipState: 'completed',
    engagementState: 'no_response',
  },
  removed: { membershipState: 'removed' },
};

export function isCampaignEvent(value: string): value is CampaignEvent {
  return CAMPAIGN_EVENT_VALUES.includes(value);
}

/** Events that carry no state change — stored for history and scoring only. */
export function isSignalOnlyEvent(event: CampaignEvent): boolean {
  const effect = CAMPAIGN_EVENT_EFFECTS[event];
  return (
    effect.membershipState === undefined &&
    effect.engagementState === undefined &&
    effect.disposition === undefined
  );
}

// ============================================
// CHANNEL CONSENT
// ============================================

export const CONTACT_CHANNELS = [
  { label: 'Email', value: 'email' },
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'Phone', value: 'phone' },
] as const;

export type ContactChannel = (typeof CONTACT_CHANNELS)[number]['value'];

export const CONTACT_CHANNEL_VALUES: string[] = CONTACT_CHANNELS.map(
  (c) => c.value as string,
);

export const CONSENT_STATES = [
  { label: 'Unknown', value: 'unknown' },
  { label: 'Granted', value: 'granted' },
  { label: 'Revoked', value: 'revoked' },
] as const;

export type ConsentState = (typeof CONSENT_STATES)[number]['value'];

export const CONSENT_STATE_VALUES: string[] = CONSENT_STATES.map(
  (c) => c.value as string,
);

/**
 * Outbound is opt-out, not opt-in: `unknown` is contactable, `revoked` is not.
 * Revocation is per channel — an email opt-out does not silence LinkedIn.
 */
export function isChannelContactable(consent: ConsentState): boolean {
  return consent !== 'revoked';
}

// ============================================
// IDENTITY RESOLUTION
// ============================================

/**
 * Fields used to match a sourced person against records we already hold, in
 * priority order. A prospect that matches an existing Contact links to it
 * instead of becoming a second copy of the same human.
 *
 * `externalId` is only ever matched together with `externalType`: the same id
 * string means different people in different systems.
 */
export const PROSPECT_IDENTITY_KEYS = [
  'externalId',
  'email',
  'linkedinUrl',
] as const;

export type ProspectIdentityKey = (typeof PROSPECT_IDENTITY_KEYS)[number];

/**
 * Systems a prospect can come from. Open by design — a value outside this list
 * is allowed, since the point of the generic pair is that adding a provider
 * needs no schema change. These are the ones we know how to sync.
 */
export const KNOWN_EXTERNAL_TYPES = [
  { label: 'Apollo', value: 'apollo' },
  { label: 'Origami', value: 'origami' },
  { label: 'Salesforce', value: 'salesforce' },
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'Manual', value: 'manual' },
] as const;

export const KNOWN_EXTERNAL_TYPE_VALUES: string[] = KNOWN_EXTERNAL_TYPES.map(
  (t) => t.value as string,
);

// ============================================
// LEAD HANDOFF
// ============================================

/**
 * Status a Lead is created with when a prospect is promoted. Kept here so the
 * promotion path and the existing lead state machine stay in step.
 */
export const PROMOTED_LEAD_STATUS = 'replied';

import type {
  CampaignDisposition,
  CampaignMembershipState,
  ConsentState,
  EngagementState,
  ProspectStatus,
} from '@/lib/api/prospects';

/**
 * Display metadata for the prospect lifecycle. The vocabulary itself is owned
 * by libs/sales/src/lib/constants/prospects.ts — this file only decides how it
 * looks. See docs/concepts/prospect-lifecycle.mdx.
 */

type BadgeColor = 'zinc' | 'blue' | 'green' | 'red' | 'amber' | 'purple';

export const humanize = (value: string) => value.replace(/_/g, ' ');

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  new: 'New',
  enrolled: 'Enrolled',
  engaged: 'Engaged',
  promoted: 'Promoted',
  disqualified: 'Disqualified',
  suppressed: 'Suppressed',
};

export const PROSPECT_STATUS_COLORS: Record<ProspectStatus, BadgeColor> = {
  new: 'zinc',
  enrolled: 'blue',
  engaged: 'green',
  promoted: 'purple',
  disqualified: 'amber',
  suppressed: 'red',
};

export const MEMBERSHIP_STATE_LABELS: Record<CampaignMembershipState, string> =
  {
    identified: 'Identified',
    enrolled: 'Enrolled',
    active: 'Active',
    completed: 'Completed',
    removed: 'Removed',
  };

export const MEMBERSHIP_STATE_COLORS: Record<
  CampaignMembershipState,
  BadgeColor
> = {
  identified: 'zinc',
  enrolled: 'blue',
  active: 'green',
  completed: 'purple',
  removed: 'red',
};

export const ENGAGEMENT_LABELS: Record<EngagementState, string> = {
  not_contacted: 'Not contacted',
  contacted: 'Contacted',
  responded: 'Responded',
  no_response: 'No response',
  unreachable: 'Unreachable',
};

export const ENGAGEMENT_COLORS: Record<EngagementState, BadgeColor> = {
  not_contacted: 'zinc',
  contacted: 'blue',
  responded: 'green',
  no_response: 'amber',
  unreachable: 'red',
};

export const DISPOSITION_LABELS: Record<CampaignDisposition, string> = {
  interested: 'Interested',
  nurture: 'Nurture',
  disqualified: 'Disqualified',
  opted_out: 'Opted out',
};

export const DISPOSITION_COLORS: Record<CampaignDisposition, BadgeColor> = {
  interested: 'green',
  nurture: 'blue',
  disqualified: 'amber',
  opted_out: 'red',
};

export const CONSENT_LABELS: Record<ConsentState, string> = {
  unknown: 'Unknown',
  granted: 'Granted',
  revoked: 'Revoked',
};

export const CONSENT_COLORS: Record<ConsentState, BadgeColor> = {
  unknown: 'zinc',
  granted: 'green',
  revoked: 'red',
};

/** What each event means in the timeline, in plain words. */
export const EVENT_LABELS: Record<string, string> = {
  enrolled: 'Enrolled in campaign',
  email_sent: 'Email sent',
  email_delivered: 'Email delivered',
  email_opened: 'Opened',
  email_clicked: 'Clicked a link',
  email_bounced: 'Bounced',
  call_placed: 'Called',
  call_connected: 'Call connected',
  voicemail_left: 'Left voicemail',
  call_no_answer: 'No answer',
  call_failed: 'Number unreachable',
  connection_requested: 'Connection requested',
  connection_accepted: 'Connection accepted',
  linkedin_message_sent: 'LinkedIn message sent',
  reply_received: 'Replied',
  meeting_booked: 'Booked a meeting',
  opted_out: 'Opted out',
  sequence_finished: 'Sequence finished',
  removed: 'Removed from campaign',
};

/** Opens and clicks are signals, not state changes — shown muted. */
export const SIGNAL_ONLY_EVENTS = new Set([
  'email_opened',
  'email_clicked',
  'call_no_answer',
]);

export const isOpenMembership = (state: CampaignMembershipState) =>
  state === 'identified' || state === 'enrolled' || state === 'active';

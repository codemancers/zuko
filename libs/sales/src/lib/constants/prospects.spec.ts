import {
  CAMPAIGN_DISPOSITION_VALUES,
  CAMPAIGN_EVENT_EFFECTS,
  CAMPAIGN_EVENT_VALUES,
  CAMPAIGN_MEMBERSHIP_STATE_VALUES,
  CAMPAIGN_MEMBERSHIP_TRANSITIONS,
  DISPOSITION_TO_PROSPECT_STATUS,
  ENGAGEMENT_STATE_VALUES,
  ENGAGEMENT_TRANSITIONS,
  OPEN_MEMBERSHIP_STATES,
  KNOWN_EXTERNAL_TYPE_VALUES,
  PROSPECT_IDENTITY_KEYS,
  PROSPECT_STATUS_TRANSITIONS,
  PROSPECT_STATUS_VALUES,
  TERMINAL_MEMBERSHIP_STATES,
  canEnrollProspect,
  canTransitionEngagement,
  canTransitionMembership,
  canTransitionProspect,
  isCampaignDisposition,
  isCampaignEvent,
  isCampaignMembershipState,
  isChannelContactable,
  isEngagementState,
  isOpenMembershipState,
  isPositiveDisposition,
  isPositiveEngagement,
  isPromotableProspect,
  isProspectStatus,
  isSignalOnlyEvent,
  isTerminalMembershipState,
  prospectStatusForDisposition,
  requiresDisposition,
} from './prospects';
import type {
  CampaignDisposition,
  CampaignEvent,
  CampaignMembershipState,
  EngagementState,
  ProspectStatus,
} from './prospects';

describe('prospect lifecycle', () => {
  describe('prospect status transitions', () => {
    it('Allows enrolling, disqualifying and suppressing a new prospect', () => {
      expect(canTransitionProspect('new', 'enrolled')).toBe(true);
      expect(canTransitionProspect('new', 'disqualified')).toBe(true);
      expect(canTransitionProspect('new', 'suppressed')).toBe(true);
    });

    it('Rejects promoting a prospect that has not engaged', () => {
      expect(canTransitionProspect('new', 'promoted')).toBe(false);
      expect(canTransitionProspect('enrolled', 'promoted')).toBe(false);
      expect(canTransitionProspect('engaged', 'promoted')).toBe(true);
    });

    it('Lets a promoted prospect fall back to engaged when the lead is reverted', () => {
      expect(canTransitionProspect('promoted', 'engaged')).toBe(true);
    });

    it('Requires an explicit manual action to leave suppression or disqualification', () => {
      expect(canTransitionProspect('suppressed', 'new')).toBe(false);
      expect(canTransitionProspect('suppressed', 'new', { manual: true })).toBe(
        true,
      );
      expect(canTransitionProspect('disqualified', 'new')).toBe(false);
      expect(
        canTransitionProspect('disqualified', 'new', { manual: true }),
      ).toBe(true);
    });

    it('Never leaves suppression for anything but a fresh start', () => {
      expect(
        canTransitionProspect('suppressed', 'enrolled', { manual: true }),
      ).toBe(false);
      expect(
        canTransitionProspect('suppressed', 'engaged', { manual: true }),
      ).toBe(false);
    });

    it('Treats a status as a no-op rather than a self-transition', () => {
      for (const status of PROSPECT_STATUS_VALUES as ProspectStatus[]) {
        expect(PROSPECT_STATUS_TRANSITIONS[status]).not.toContain(status);
      }
    });

    it('Only references known statuses as targets', () => {
      for (const targets of Object.values(PROSPECT_STATUS_TRANSITIONS)) {
        for (const target of targets) {
          expect(isProspectStatus(target)).toBe(true);
        }
      }
    });

    it('Always allows suppression from any non-suppressed status', () => {
      const statuses = PROSPECT_STATUS_VALUES as ProspectStatus[];
      for (const status of statuses.filter((s) => s !== 'suppressed')) {
        expect(PROSPECT_STATUS_TRANSITIONS[status]).toContain('suppressed');
      }
    });
  });

  describe('enrolment eligibility', () => {
    it('Enrols new and already-enrolled prospects only', () => {
      expect(canEnrollProspect('new')).toBe(true);
      expect(canEnrollProspect('enrolled')).toBe(true);
    });

    it('Refuses to enrol engaged, promoted, disqualified or suppressed prospects', () => {
      expect(canEnrollProspect('engaged')).toBe(false);
      expect(canEnrollProspect('promoted')).toBe(false);
      expect(canEnrollProspect('disqualified')).toBe(false);
      expect(canEnrollProspect('suppressed')).toBe(false);
    });

    it('Promotes engaged prospects only', () => {
      expect(isPromotableProspect('engaged')).toBe(true);
      expect(isPromotableProspect('enrolled')).toBe(false);
      expect(isPromotableProspect('promoted')).toBe(false);
    });
  });

  describe('campaign membership state', () => {
    it('Walks a membership from identified through to completed', () => {
      expect(canTransitionMembership('identified', 'enrolled')).toBe(true);
      expect(canTransitionMembership('enrolled', 'active')).toBe(true);
      expect(canTransitionMembership('active', 'completed')).toBe(true);
    });

    it('Refuses to skip enrolment or reopen a closed membership', () => {
      expect(canTransitionMembership('identified', 'active')).toBe(false);
      expect(canTransitionMembership('completed', 'active')).toBe(false);
      expect(canTransitionMembership('removed', 'enrolled')).toBe(false);
    });

    it('Allows removal from every open state', () => {
      for (const state of OPEN_MEMBERSHIP_STATES) {
        expect(canTransitionMembership(state, 'removed')).toBe(true);
      }
    });

    it('Classifies every state as exactly one of open or terminal', () => {
      for (const state of CAMPAIGN_MEMBERSHIP_STATE_VALUES as CampaignMembershipState[]) {
        expect(isCampaignMembershipState(state)).toBe(true);
        expect(isOpenMembershipState(state)).toBe(
          !isTerminalMembershipState(state),
        );
      }
    });

    it('Leaves terminal states without outgoing transitions', () => {
      for (const state of TERMINAL_MEMBERSHIP_STATES) {
        expect(CAMPAIGN_MEMBERSHIP_TRANSITIONS[state]).toEqual([]);
      }
    });

    it('Requires a disposition only once the membership closes', () => {
      expect(requiresDisposition('completed')).toBe(true);
      expect(requiresDisposition('removed')).toBe(true);
      expect(requiresDisposition('active')).toBe(false);
      expect(requiresDisposition('identified')).toBe(false);
    });
  });

  describe('engagement state', () => {
    it('Walks from not contacted through to a response', () => {
      expect(canTransitionEngagement('not_contacted', 'contacted')).toBe(true);
      expect(canTransitionEngagement('contacted', 'responded')).toBe(true);
      expect(canTransitionEngagement('contacted', 'no_response')).toBe(true);
    });

    it('Refuses a response from someone never contacted', () => {
      expect(canTransitionEngagement('not_contacted', 'responded')).toBe(false);
      expect(canTransitionEngagement('not_contacted', 'no_response')).toBe(
        false,
      );
    });

    it('Accepts a late reply after the sequence gave up', () => {
      expect(canTransitionEngagement('no_response', 'responded')).toBe(true);
    });

    it('Treats responded and unreachable as final', () => {
      expect(ENGAGEMENT_TRANSITIONS.responded).toEqual([]);
      expect(ENGAGEMENT_TRANSITIONS.unreachable).toEqual([]);
      expect(canTransitionEngagement('unreachable', 'contacted')).toBe(false);
    });

    it('Only references known engagement states as targets', () => {
      for (const targets of Object.values(ENGAGEMENT_TRANSITIONS)) {
        for (const target of targets) {
          expect(isEngagementState(target)).toBe(true);
        }
      }
    });

    it('Counts only a response as positive engagement', () => {
      for (const state of ENGAGEMENT_STATE_VALUES as EngagementState[]) {
        expect(isPositiveEngagement(state)).toBe(state === 'responded');
      }
    });
  });

  describe('dispositions', () => {
    it('Maps each disposition onto the prospect standing it implies', () => {
      expect(prospectStatusForDisposition('interested')).toBe('engaged');
      expect(prospectStatusForDisposition('nurture')).toBe('new');
      expect(prospectStatusForDisposition('disqualified')).toBe('disqualified');
      expect(prospectStatusForDisposition('opted_out')).toBe('suppressed');
    });

    it('Returns a prospect to the pool on nurture, so a later campaign can retry', () => {
      expect(canEnrollProspect(prospectStatusForDisposition('nurture'))).toBe(
        true,
      );
      expect(canEnrollProspect(prospectStatusForDisposition('opted_out'))).toBe(
        false,
      );
    });

    it('Puts only interested prospects on the promotion path', () => {
      for (const value of CAMPAIGN_DISPOSITION_VALUES as CampaignDisposition[]) {
        expect(isCampaignDisposition(value)).toBe(true);
        expect(isPositiveDisposition(value)).toBe(value === 'interested');
      }
    });

    it('Gives every disposition a resulting status, and every status is real', () => {
      for (const value of CAMPAIGN_DISPOSITION_VALUES as CampaignDisposition[]) {
        const status = DISPOSITION_TO_PROSPECT_STATUS[value];
        expect(status).toBeDefined();
        expect(isProspectStatus(status)).toBe(true);
      }
    });
  });

  describe('campaign events', () => {
    it('Keeps opens and clicks as signals that change no state', () => {
      expect(isSignalOnlyEvent('message_opened')).toBe(true);
      expect(isSignalOnlyEvent('message_clicked')).toBe(true);
    });

    it('Changes state on the events that actually mean something', () => {
      expect(isSignalOnlyEvent('reply_received')).toBe(false);
      expect(isSignalOnlyEvent('opted_out')).toBe(false);
      expect(isSignalOnlyEvent('message_bounced')).toBe(false);
    });

    it('Drives a reply to responded without settling a disposition', () => {
      const effect = CAMPAIGN_EVENT_EFFECTS.reply_received;
      expect(effect.engagementState).toBe('responded');
      expect(effect.disposition).toBeUndefined();
    });

    it('Treats a booked meeting as interest, not merely a reply', () => {
      const effect = CAMPAIGN_EVENT_EFFECTS.meeting_booked;
      expect(effect.engagementState).toBe('responded');
      expect(effect.disposition).toBe('interested');
    });

    it('Closes the membership on an opt-out and suppresses the prospect', () => {
      const effect = CAMPAIGN_EVENT_EFFECTS.opted_out;
      expect(effect.membershipState).toBe('removed');
      expect(effect.disposition).toBe('opted_out');
      expect(prospectStatusForDisposition(effect.disposition!)).toBe(
        'suppressed',
      );
    });

    it('Marks a bounced recipient unreachable and removes them', () => {
      const effect = CAMPAIGN_EVENT_EFFECTS.message_bounced;
      expect(effect.membershipState).toBe('removed');
      expect(effect.engagementState).toBe('unreachable');
    });

    it('Only produces states and dispositions that exist', () => {
      for (const value of CAMPAIGN_EVENT_VALUES as CampaignEvent[]) {
        expect(isCampaignEvent(value)).toBe(true);
        const effect = CAMPAIGN_EVENT_EFFECTS[value];
        expect(effect).toBeDefined();
        if (effect.membershipState) {
          expect(isCampaignMembershipState(effect.membershipState)).toBe(true);
        }
        if (effect.engagementState) {
          expect(isEngagementState(effect.engagementState)).toBe(true);
        }
        if (effect.disposition) {
          expect(isCampaignDisposition(effect.disposition)).toBe(true);
        }
      }
    });

    it('Never settles a disposition without also closing the membership', () => {
      for (const value of CAMPAIGN_EVENT_VALUES as CampaignEvent[]) {
        const effect = CAMPAIGN_EVENT_EFFECTS[value];
        if (effect.disposition && value !== 'meeting_booked') {
          expect(effect.membershipState).toBeDefined();
          expect(
            isTerminalMembershipState(
              effect.membershipState as CampaignMembershipState,
            ),
          ).toBe(true);
        }
      }
    });
  });

  describe('channel consent', () => {
    it('Treats unknown consent as contactable and revoked as silent', () => {
      expect(isChannelContactable('unknown')).toBe(true);
      expect(isChannelContactable('granted')).toBe(true);
      expect(isChannelContactable('revoked')).toBe(false);
    });
  });

  describe('identity resolution', () => {
    it('Matches on the external identity before email or LinkedIn', () => {
      expect(PROSPECT_IDENTITY_KEYS).toEqual([
        'externalId',
        'email',
        'linkedinUrl',
      ]);
    });

    it('Names the systems we sync, without closing the set', () => {
      expect(KNOWN_EXTERNAL_TYPE_VALUES).toEqual(
        expect.arrayContaining(['apollo', 'origami', 'salesforce']),
      );
    });
  });
});

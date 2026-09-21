import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProspectsRepository } from '../repositories/prospects.repository';
import type {
  CreateProspectInput,
  ProspectFilters,
  ProspectIdentity,
  UpdateProspectInput,
} from '../repositories/prospects.repository';
import { LeadsRepository } from '../repositories/leads.repository';
import type {
  CampaignDisposition,
  CampaignEvent,
  CampaignMembershipState,
  ContactChannel,
  EngagementState,
  ProspectStatus,
} from '../constants/prospects';
import { ACTIVITY_SOURCES } from '../events/deal-events';
import type { ActivitySource } from '../events/deal-events';
import { PROSPECT_EVENTS } from '../events/prospect-events';
import { LEAD_EVENTS } from '../events/lead-events';
import {
  CAMPAIGN_EVENT_EFFECTS,
  CONSENT_STATE_VALUES,
  CONTACT_CHANNEL_VALUES,
  EVENT_CHANNEL,
  INBOUND_EVENTS,
  OPEN_MEMBERSHIP_STATES,
  PROMOTED_LEAD_STATUS,
  canEnrollProspect,
  canTransitionEngagement,
  isOutboundBlocked,
  isTerminalMembershipState,
  outboundBlockedReason,
  canTransitionMembership,
  canTransitionProspect,
  isCampaignDisposition,
  isCampaignEvent,
  isChannelContactable,
  isProspectStatus,
  isPromotableProspect,
  prospectStatusForDisposition,
} from '../constants/prospects';

export interface EnrolProspectOptions {
  /** Skip the eligibility check — never set from an agent or a webhook. */
  force?: boolean;
  /** Which channel the campaign will use. */
  channel?: string;
  actor?: ProspectActor;
}

export interface SetStatusOptions {
  manual?: boolean;
  actor?: ProspectActor;
}

/**
 * Who is driving a change, and through what. Recorded on every event so the
 * history answers "who did this" as well as "what happened".
 */
export interface ProspectActor {
  userId?: number;
  /** system | user | agent | provider */
  source?: string;
}

/** Days of quiet before a prospect who never answered may be approached again. */
export const DEFAULT_NO_RESPONSE_COOLDOWN_DAYS = 75;

const addDays = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const CONSENT_FIELD_BY_CHANNEL: Record<
  ContactChannel,
  'emailConsent' | 'linkedinConsent' | 'phoneConsent'
> = {
  email: 'emailConsent',
  linkedin: 'linkedinConsent',
  phone: 'phoneConsent',
};

@Injectable()
export class ProspectsService {
  constructor(
    private readonly prospects: ProspectsRepository,
    private readonly leads: LeadsRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Prospect actors speak system | user | agent | provider; the timeline only
   * labels the ones a person did not do themselves.
   */
  private activitySource(actor?: ProspectActor): ActivitySource | undefined {
    return actor?.source === 'agent' ? ACTIVITY_SOURCES.AI : undefined;
  }

  /**
   * Move a prospect's status and record the move on its timeline. Every status
   * write goes through here, so the timeline cannot fall behind the prospect.
   */
  private async changeStatus(
    id: number,
    from: string,
    to: string,
    actor?: ProspectActor,
    extra: UpdateProspectInput = {},
  ) {
    const updated = await this.prospects.update(id, { ...extra, status: to });

    await this.eventEmitter.emitAsync(PROSPECT_EVENTS.STATUS_CHANGED, {
      prospectId: id,
      from,
      to,
      actorId: actor?.userId,
      source: this.activitySource(actor),
    });

    return updated;
  }

  findAll(
    organizationId: number,
    filters: ProspectFilters = {},
    page = 1,
    perPage = 50,
  ) {
    return this.prospects.findAll(organizationId, filters, page, perPage);
  }

  async findById(id: number, organizationId: number) {
    const prospect = await this.prospects.findById(id, organizationId);
    if (!prospect) throw new NotFoundException(`Prospect ${id} not found`);
    return prospect;
  }

  countByStatus(organizationId: number) {
    return this.prospects.countByStatus(organizationId);
  }

  findEvents(prospectId: number, take?: number) {
    return this.prospects.findEvents(prospectId, take);
  }

  /**
   * Create a prospect, resolving identity first. A person we already hold is
   * enriched rather than duplicated, and one we already have as a CRM contact
   * is linked to that contact instead of shadowing it.
   */
  async create(
    organizationId: number,
    input: Omit<CreateProspectInput, 'organizationId'>,
    actor: ProspectActor = {},
  ) {
    const identity: ProspectIdentity = {
      email: input.email,
      externalType: input.externalType,
      externalId: input.externalId,
      linkedinUrl: input.linkedinUrl,
    };

    const existing = await this.prospects.findByIdentity(
      organizationId,
      identity,
    );
    if (existing) {
      // Enrich: fill blanks, never overwrite what we already know.
      const enrichment: UpdateProspectInput = {};
      if (!existing.email && input.email) enrichment.email = input.email;
      if (!existing.phone && input.phone) enrichment.phone = input.phone;
      if (!existing.title && input.title) enrichment.title = input.title;
      if (!existing.companyName && input.companyName) {
        enrichment.companyName = input.companyName;
      }
      if (!existing.linkedinUrl && input.linkedinUrl) {
        enrichment.linkedinUrl = input.linkedinUrl;
      }
      if (Object.keys(enrichment).length === 0) return existing;
      return this.prospects.update(existing.id, enrichment);
    }

    const contact =
      input.contactId === undefined
        ? await this.prospects.findMatchingContact(organizationId, identity)
        : null;

    const created = await this.prospects.create({
      ...input,
      organizationId,
      ...(contact ? { contactId: contact.id } : {}),
    });

    await this.eventEmitter.emitAsync(PROSPECT_EVENTS.CREATED, {
      prospectId: created.id,
      actorId: actor.userId,
      source: this.activitySource(actor),
    });

    return created;
  }

  async update(id: number, organizationId: number, input: UpdateProspectInput) {
    await this.findById(id, organizationId);
    if (input.status !== undefined) {
      throw new BadRequestException(
        'Status cannot be set directly. Use setStatus, which validates the transition.',
      );
    }
    return this.prospects.update(id, input);
  }

  async delete(id: number, organizationId: number) {
    await this.findById(id, organizationId);
    return this.prospects.delete(id);
  }

  /** Apply a prospect status transition, refusing anything the rules disallow. */
  async setStatus(
    id: number,
    organizationId: number,
    status: string,
    options: SetStatusOptions = {},
  ) {
    const prospect = await this.findById(id, organizationId);

    if (!isProspectStatus(status)) {
      throw new BadRequestException(`Unknown prospect status "${status}"`);
    }
    if (prospect.status === status) return prospect;

    const from = prospect.status as ProspectStatus;
    if (!canTransitionProspect(from, status, { manual: options.manual })) {
      throw new BadRequestException(
        `Cannot move a prospect from "${from}" to "${status}"` +
          (options.manual
            ? '.'
            : '. This transition requires an explicit manual action.'),
      );
    }

    return this.changeStatus(id, from, status, options.actor);
  }

  // ---- Enrolment ----

  async enrol(
    id: number,
    organizationId: number,
    campaignId: number,
    options: EnrolProspectOptions = {},
  ) {
    const prospect = await this.findById(id, organizationId);
    const status = prospect.status as ProspectStatus;

    // Checked before `force`, because force overrules eligibility, never
    // permission. A background sync must not re-enrol someone who opted out
    // or who a human has already taken over.
    if (isOutboundBlocked(status)) {
      throw new BadRequestException(
        `Cannot enrol this prospect: ${outboundBlockedReason(status)}.`,
      );
    }

    if (!options.force && !canEnrollProspect(status)) {
      throw new BadRequestException(
        `A prospect with status "${status}" cannot be enrolled in a campaign.`,
      );
    }

    if (!this.hasContactableChannel(prospect)) {
      throw new BadRequestException(
        'Prospect has no contactable channel — every channel is revoked or missing.',
      );
    }

    const open = await this.prospects.findOpenMembershipForCampaign(
      id,
      campaignId,
      OPEN_MEMBERSHIP_STATES,
    );
    if (open) {
      throw new ConflictException(
        `Prospect is already in campaign ${campaignId} (membership ${open.id}).`,
      );
    }

    // One conversation at a time: overlapping cold campaigns read as spam to
    // the person on the other end.
    const elsewhere = await this.prospects.findOpenMemberships(
      id,
      OPEN_MEMBERSHIP_STATES,
    );
    if (!options.force && elsewhere.length > 0) {
      throw new ConflictException(
        `Prospect is already in an active campaign (${elsewhere
          .map((m) => m.campaign?.name ?? m.campaignId)
          .join(', ')}). Close it first, or enrol with an override.`,
      );
    }

    // Respect the cooldown a previous "not now" or silence earned them.
    if (!options.force) {
      const cooling = await this.prospects.findCoolingOffMembership(id);
      if (cooling?.nextEligibleAt) {
        throw new ConflictException(
          `Prospect is in cooldown until ${cooling.nextEligibleAt.toISOString().slice(0, 10)}.`,
        );
      }
    }

    const membership = await this.prospects.createMembership({
      prospectId: id,
      campaignId,
      state: 'enrolled',
      channel: options.channel ?? 'email',
      enrolledAt: new Date(),
    });

    await this.prospects.recordEvent({
      membershipId: membership.id,
      prospectId: id,
      eventType: 'enrolled',
      actorId: options.actor?.userId,
      source: options.actor?.source ?? 'system',
    });

    // Only move the prospect if the lifecycle allows it. Without this a
    // forced enrol would rewrite any status to `enrolled`, so a background job
    // could quietly undo a promotion.
    if (status !== 'enrolled' && canTransitionProspect(status, 'enrolled')) {
      await this.changeStatus(id, status, 'enrolled', options.actor);
    }

    await this.eventEmitter.emitAsync(PROSPECT_EVENTS.ENROLLED, {
      prospectId: id,
      campaignId,
      channel: membership.channel,
      actorId: options.actor?.userId,
      source: this.activitySource(options.actor),
    });

    return membership;
  }

  // ---- Direct outreach ----

  /**
   * Record a touch made outside any campaign — a call someone picked up the
   * phone to make, a one-off email. Zuko is the system of record, so this does
   * not require a campaign, a sequence, or a provider to exist.
   *
   * It runs the same consent gate as campaign outreach: if the channel has
   * been revoked, we do not contact them, however the touch was initiated.
   */
  async recordDirectOutreach(
    id: number,
    organizationId: number,
    eventType: string,
    channel: string,
    actor: ProspectActor = {},
  ) {
    if (!isCampaignEvent(eventType)) {
      throw new BadRequestException(`Unknown outreach event "${eventType}"`);
    }
    if (!CONTACT_CHANNEL_VALUES.includes(channel)) {
      throw new BadRequestException(`Unknown channel "${channel}"`);
    }

    const expected = EVENT_CHANNEL[eventType as CampaignEvent];
    if (expected && expected !== channel) {
      throw new BadRequestException(
        `"${eventType}" is a ${expected} event and cannot be recorded on ${channel}.`,
      );
    }

    const prospect = await this.findById(id, organizationId);

    const outbound = !INBOUND_EVENTS.includes(eventType as CampaignEvent);

    // Standing first: suppressing someone closes their memberships but does
    // not touch per-channel consent, so a consent-only gate would happily let
    // an outbound touch through seconds after they opted out.
    const status = prospect.status as ProspectStatus;
    if (outbound && isOutboundBlocked(status)) {
      throw new BadRequestException(
        `Cannot contact this prospect: ${outboundBlockedReason(status)}.`,
      );
    }

    if (outbound && !this.isChannelUsable(prospect, channel)) {
      throw new BadRequestException(
        `Cannot contact this prospect on ${channel}: consent revoked or no address on file.`,
      );
    }

    await this.prospects.recordEvent({
      prospectId: id,
      eventType,
      channel,
      direction: outbound ? 'outbound' : 'inbound',
      actorId: actor.userId,
      source: actor.source ?? 'user',
    });

    // Without a campaign there is no membership to hold engagement, so the
    // effect lands on the prospect's own standing instead.
    const effect = CAMPAIGN_EVENT_EFFECTS[eventType as CampaignEvent];
    if (effect.disposition) {
      await this.applyDispositionToProspect(
        id,
        organizationId,
        effect.disposition,
        channel,
        actor,
      );
    } else if (effect.engagementState === 'responded') {
      const from = prospect.status as ProspectStatus;
      if (canTransitionProspect(from, 'engaged')) {
        await this.changeStatus(id, from, 'engaged', actor);
      }
    }

    return this.findById(id, organizationId);
  }

  /** The channel has an address on file and has not been revoked. */
  private isChannelUsable(
    prospect: {
      email?: string | null;
      linkedinUrl?: string | null;
      phone?: string | null;
      emailConsent: string;
      linkedinConsent: string;
      phoneConsent: string;
    },
    channel: string,
  ): boolean {
    const byChannel: Record<string, [string | null | undefined, string]> = {
      email: [prospect.email, prospect.emailConsent],
      linkedin: [prospect.linkedinUrl, prospect.linkedinConsent],
      phone: [prospect.phone, prospect.phoneConsent],
    };
    const entry = byChannel[channel];
    if (!entry) return false;
    const [value, consent] = entry;
    return Boolean(value) && isChannelContactable(consent as never);
  }

  // ---- Campaign activity ----

  /**
   * Append an event and let the derived states follow. Events are the record of
   * what happened; the three axes are recomputed from them, never set by hand.
   */
  async recordEvent(
    membershipId: number,
    organizationId: number,
    eventType: string,
    payload?: unknown,
    externalId?: string,
    occurredAt?: Date,
    actor: ProspectActor = {},
  ) {
    if (!isCampaignEvent(eventType)) {
      throw new BadRequestException(`Unknown campaign event "${eventType}"`);
    }

    const membership = await this.loadMembership(membershipId, organizationId);

    // Provider webhooks retry; the same event must not be applied twice.
    if (externalId) {
      const seen = await this.prospects.findEventByExternalId(
        membershipId,
        externalId,
      );
      if (seen) return this.prospects.findMembership(membershipId);
    }

    await this.prospects.recordEvent({
      membershipId,
      prospectId: membership.prospectId,
      eventType,
      payload,
      externalId,
      occurredAt,
      actorId: actor.userId,
      // An event carrying a provider id came from the provider, whatever
      // called us.
      source: actor.source ?? (externalId ? 'provider' : 'system'),
    });

    return this.applyEventEffects(
      membership,
      eventType as CampaignEvent,
      actor,
    );
  }

  private async applyEventEffects(
    membership: NonNullable<
      Awaited<ReturnType<ProspectsRepository['findMembership']>>
    >,
    event: CampaignEvent,
    actor: ProspectActor = {},
  ) {
    const effect = CAMPAIGN_EVENT_EFFECTS[event];
    const update: {
      state?: string;
      engagement?: string;
      disposition?: string;
      closedAt?: Date;
    } = {};

    const currentState = membership.state as CampaignMembershipState;
    if (
      effect.membershipState &&
      canTransitionMembership(currentState, effect.membershipState)
    ) {
      update.state = effect.membershipState;
      // Only a terminal state closes a membership. `active` is the work
      // starting, not ending — stamping closedAt there gives every membership
      // that saw a send a close time it never had.
      if (isTerminalMembershipState(effect.membershipState)) {
        update.closedAt = new Date();
      }
    }

    const currentEngagement = membership.engagement as EngagementState;
    if (
      effect.engagementState &&
      canTransitionEngagement(currentEngagement, effect.engagementState)
    ) {
      update.engagement = effect.engagementState;
    }

    if (effect.disposition && !membership.disposition) {
      update.disposition = effect.disposition;
    }

    if (Object.keys(update).length === 0) {
      return this.prospects.findMembership(membership.id);
    }

    const updated = await this.prospects.updateMembership(
      membership.id,
      update,
    );

    if (update.disposition) {
      await this.applyDispositionToProspect(
        membership.prospectId,
        membership.prospect.organizationId,
        update.disposition as CampaignDisposition,
        membership.channel,
        actor,
      );
    }

    return updated;
  }

  /** Conclude a membership, which settles the prospect's standing. */
  async setDisposition(
    membershipId: number,
    organizationId: number,
    disposition: string,
    options: { actor?: ProspectActor; nextEligibleAt?: Date } = {},
  ) {
    if (!isCampaignDisposition(disposition)) {
      throw new BadRequestException(`Unknown disposition "${disposition}"`);
    }

    const membership = await this.loadMembership(membershipId, organizationId);
    const state = membership.state as CampaignMembershipState;

    const update: Record<string, unknown> = { disposition };
    // Concluding an open membership closes it — a conclusion means we are done.
    if (canTransitionMembership(state, 'removed')) {
      update.state = 'removed';
      update.closedAt = new Date();
    }

    // "Not now" sets when we may come back: an explicit date if the reply gave
    // one, otherwise the default cooldown.
    if (disposition === 'nurture') {
      update.nextEligibleAt =
        options.nextEligibleAt ?? addDays(DEFAULT_NO_RESPONSE_COOLDOWN_DAYS);
    }

    const updated = await this.prospects.updateMembership(membershipId, update);

    // The conclusion is itself something that happened — record who reached it.
    await this.prospects.recordEvent({
      membershipId,
      prospectId: membership.prospectId,
      eventType: 'removed',
      payload: { disposition },
      actorId: options.actor?.userId,
      source: options.actor?.source ?? 'user',
    });

    await this.applyDispositionToProspect(
      membership.prospectId,
      membership.prospect.organizationId,
      disposition,
      membership.channel,
      options.actor,
    );

    return updated;
  }

  private async applyDispositionToProspect(
    prospectId: number,
    organizationId: number,
    disposition: CampaignDisposition,
    channel?: string,
    actor: ProspectActor = {},
  ) {
    const target = prospectStatusForDisposition(disposition);
    const prospect = await this.prospects.findById(prospectId, organizationId);
    if (!prospect) return;

    // Consent is revoked first, whatever the status does: it is a legal fact
    // about one channel, not a consequence of a status change. Skipping it when
    // the status happens to be a no-op would silently keep contacting someone
    // who asked us to stop on a second channel. A channel already revoked is
    // left alone so the timeline does not repeat itself.
    if (disposition === 'opted_out' && channel) {
      const field = CONSENT_FIELD_BY_CHANNEL[channel as ContactChannel];
      if (field && prospect[field] !== 'revoked') {
        await this.prospects.update(prospectId, { [field]: 'revoked' });
        await this.eventEmitter.emitAsync(PROSPECT_EVENTS.CONSENT_CHANGED, {
          prospectId,
          channel,
          from: prospect[field],
          to: 'revoked',
          actorId: actor.userId,
          source: this.activitySource(actor),
        });
      }
    }

    const from = prospect.status as ProspectStatus;
    if (from === target) return;

    // Returning a prospect to the pool says they are in no campaign at all.
    // `force` lets a prospect hold more than one open membership, so one
    // campaign concluding `nurture` must not advertise them as available
    // while another is still running — that would also make them enrollable
    // again with no override needed. The other three targets are judgements
    // about the person rather than about a campaign, and hold however many
    // memberships are still open.
    if (target === 'new') {
      const stillOpen = await this.prospects.findOpenMemberships(
        prospectId,
        OPEN_MEMBERSHIP_STATES,
      );
      if (stillOpen.length > 0) return;
    }

    if (!canTransitionProspect(from, target)) return;

    await this.changeStatus(prospectId, from, target, actor);
  }

  // ---- Promotion ----

  /**
   * Promote an engaged prospect to a lead: create the lead, close every open
   * membership so automation stops, and mark the prospect promoted.
   */
  async promote(id: number, organizationId: number, actor: ProspectActor = {}) {
    const prospect = await this.findById(id, organizationId);
    const status = prospect.status as ProspectStatus;

    if (!isPromotableProspect(status)) {
      throw new BadRequestException(
        `Only an engaged prospect can be promoted. This one is "${status}".`,
      );
    }
    if (prospect.leadId) {
      throw new ConflictException(
        `Prospect is already promoted to lead ${prospect.leadId}.`,
      );
    }

    const primaryCampaignId = prospect.memberships[0]?.campaignId;

    const lead = await this.leads.create({
      organizationId,
      name: prospect.name,
      ...(prospect.email ? { email: prospect.email } : {}),
      ...(prospect.phone ? { phone: prospect.phone } : {}),
      ...(prospect.companyName ? { companyName: prospect.companyName } : {}),
      ...(prospect.title ? { title: prospect.title } : {}),
      ...(prospect.linkedinUrl ? { linkedinUrl: prospect.linkedinUrl } : {}),
      // Both halves or neither: an id without its system cannot be matched.
      ...(prospect.externalType && prospect.externalId
        ? {
            externalType: prospect.externalType,
            externalId: prospect.externalId,
          }
        : {}),
      ...(prospect.icpProfileId ? { icpProfileId: prospect.icpProfileId } : {}),
      ...(primaryCampaignId ? { campaignId: primaryCampaignId } : {}),
      // Reuse the CRM contact identity resolution already found, so an
      // existing customer is not duplicated by the promotion.
      ...(prospect.contactId ? { contactId: prospect.contactId } : {}),
      status: PROMOTED_LEAD_STATUS,
      source: prospect.source,
    });

    await this.closeOpenMemberships(id, 'interested');

    const promoted = await this.changeStatus(id, status, 'promoted', actor, {
      leadId: lead.id,
    });

    await this.eventEmitter.emitAsync(PROSPECT_EVENTS.PROMOTED, {
      prospectId: id,
      leadId: lead.id,
      actorId: actor.userId,
      source: this.activitySource(actor),
    });

    // The lead starts its own timeline with the promotion that created it.
    await this.eventEmitter.emitAsync(LEAD_EVENTS.CREATED, {
      leadId: lead.id,
      prospectId: id,
      actorId: actor.userId,
      source: this.activitySource(actor),
    });

    return { prospect: promoted, lead };
  }

  /** Reverse a promotion — the lead is gone, the prospect returns to engaged. */
  async demote(id: number, organizationId: number, actor: ProspectActor = {}) {
    const prospect = await this.findById(id, organizationId);
    if (!prospect.leadId) {
      throw new BadRequestException('Prospect has not been promoted.');
    }

    const leadId = prospect.leadId;
    const demoted = await this.changeStatus(
      id,
      prospect.status,
      'engaged',
      actor,
      { leadId: null },
    );

    await this.eventEmitter.emitAsync(PROSPECT_EVENTS.DEMOTED, {
      prospectId: id,
      leadId,
      actorId: actor.userId,
      source: this.activitySource(actor),
    });

    return demoted;
  }

  private async closeOpenMemberships(
    prospectId: number,
    disposition: CampaignDisposition,
  ) {
    const open = await this.prospects.findOpenMemberships(
      prospectId,
      OPEN_MEMBERSHIP_STATES,
    );

    await Promise.all(
      open.map((membership) =>
        this.prospects.updateMembership(membership.id, {
          state: 'removed',
          disposition: membership.disposition ?? disposition,
          closedAt: new Date(),
        }),
      ),
    );

    return open.length;
  }

  // ---- Consent and suppression ----

  async setConsent(
    id: number,
    organizationId: number,
    channel: string,
    consent: string,
    actor: ProspectActor = {},
  ) {
    const field = CONSENT_FIELD_BY_CHANNEL[channel as ContactChannel];
    if (!field) {
      throw new BadRequestException(`Unknown channel "${channel}"`);
    }
    if (!CONSENT_STATE_VALUES.includes(consent)) {
      throw new BadRequestException(`Unknown consent state "${consent}"`);
    }

    const prospect = await this.findById(id, organizationId);
    const updated = await this.prospects.update(id, { [field]: consent });

    if (prospect[field] !== consent) {
      await this.eventEmitter.emitAsync(PROSPECT_EVENTS.CONSENT_CHANGED, {
        prospectId: id,
        channel,
        from: prospect[field],
        to: consent,
        actorId: actor.userId,
        source: this.activitySource(actor),
      });
    }

    // Nothing left to reach them on — record that as suppression rather than
    // leaving it to be rediscovered at send time.
    if (!this.hasContactableChannel(updated)) {
      return this.suppress(id, organizationId, actor);
    }

    return updated;
  }

  async suppress(
    id: number,
    organizationId: number,
    actor: ProspectActor = {},
  ) {
    const prospect = await this.findById(id, organizationId);
    const from = prospect.status as ProspectStatus;

    await this.closeOpenMemberships(id, 'opted_out');

    if (from === 'suppressed') return prospect;

    const suppressed = await this.changeStatus(id, from, 'suppressed', actor);

    await this.eventEmitter.emitAsync(PROSPECT_EVENTS.SUPPRESSED, {
      prospectId: id,
      actorId: actor.userId,
      source: this.activitySource(actor),
    });

    return suppressed;
  }

  private hasContactableChannel(prospect: {
    email?: string | null;
    linkedinUrl?: string | null;
    phone?: string | null;
    emailConsent: string;
    linkedinConsent: string;
    phoneConsent: string;
  }): boolean {
    const channels: [string | null | undefined, string][] = [
      [prospect.email, prospect.emailConsent],
      [prospect.linkedinUrl, prospect.linkedinConsent],
      [prospect.phone, prospect.phoneConsent],
    ];

    return channels.some(
      ([value, consent]) =>
        Boolean(value) && isChannelContactable(consent as never),
    );
  }

  private async loadMembership(membershipId: number, organizationId: number) {
    const membership = await this.prospects.findMembership(membershipId);
    if (!membership || membership.prospect.organizationId !== organizationId) {
      throw new NotFoundException(`Membership ${membershipId} not found`);
    }
    return membership;
  }
}

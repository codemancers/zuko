import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { ActivityService } from '../services/activity.service';
import type {
  ProspectConsentChangedEvent,
  ProspectCreatedEvent,
  ProspectDemotedEvent,
  ProspectEnrolledEvent,
  ProspectPromotedEvent,
  ProspectStatusChangedEvent,
  ProspectSuppressedEvent,
} from '../events/prospect-events';
import { PROSPECT_EVENTS } from '../events/prospect-events';

@Injectable()
export class ProspectActivityListener {
  constructor(private readonly activityService: ActivityService) {}

  private src(event: { source?: string }) {
    return event.source ? { source: event.source } : {};
  }

  @OnEvent(PROSPECT_EVENTS.CREATED)
  async handleProspectCreated(event: ProspectCreatedEvent) {
    await this.activityService.create({
      activityType: 'prospect_created',
      entityType: 'prospect',
      entityId: event.prospectId,
      actorId: event.actorId,
      metadata: { ...this.src(event) },
    });
  }

  @OnEvent(PROSPECT_EVENTS.STATUS_CHANGED)
  async handleStatusChanged(event: ProspectStatusChangedEvent) {
    await this.activityService.create({
      activityType: 'prospect_status_changed',
      entityType: 'prospect',
      entityId: event.prospectId,
      actorId: event.actorId,
      metadata: {
        from: event.from,
        to: event.to,
        ...this.src(event),
      },
    });
  }

  @OnEvent(PROSPECT_EVENTS.ENROLLED)
  async handleEnrolled(event: ProspectEnrolledEvent) {
    await this.activityService.create({
      activityType: 'prospect_enrolled',
      entityType: 'prospect',
      entityId: event.prospectId,
      actorId: event.actorId,
      metadata: {
        campaignId: event.campaignId,
        ...(event.campaignName ? { campaignName: event.campaignName } : {}),
        channel: event.channel,
        ...this.src(event),
      },
    });
  }

  @OnEvent(PROSPECT_EVENTS.PROMOTED)
  async handlePromoted(event: ProspectPromotedEvent) {
    await this.activityService.create({
      activityType: 'prospect_promoted',
      entityType: 'prospect',
      entityId: event.prospectId,
      actorId: event.actorId,
      metadata: {
        leadId: event.leadId,
        ...this.src(event),
      },
    });
  }

  @OnEvent(PROSPECT_EVENTS.DEMOTED)
  async handleDemoted(event: ProspectDemotedEvent) {
    await this.activityService.create({
      activityType: 'prospect_demoted',
      entityType: 'prospect',
      entityId: event.prospectId,
      actorId: event.actorId,
      metadata: {
        leadId: event.leadId,
        ...this.src(event),
      },
    });
  }

  @OnEvent(PROSPECT_EVENTS.CONSENT_CHANGED)
  async handleConsentChanged(event: ProspectConsentChangedEvent) {
    await this.activityService.create({
      activityType: 'prospect_consent_changed',
      entityType: 'prospect',
      entityId: event.prospectId,
      actorId: event.actorId,
      metadata: {
        channel: event.channel,
        from: event.from,
        to: event.to,
        ...this.src(event),
      },
    });
  }

  @OnEvent(PROSPECT_EVENTS.SUPPRESSED)
  async handleSuppressed(event: ProspectSuppressedEvent) {
    await this.activityService.create({
      activityType: 'prospect_suppressed',
      entityType: 'prospect',
      entityId: event.prospectId,
      actorId: event.actorId,
      metadata: { ...this.src(event) },
    });
  }
}

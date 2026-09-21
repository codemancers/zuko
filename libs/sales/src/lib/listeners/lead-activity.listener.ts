import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { ActivityService } from '../services/activity.service';
import type {
  LeadConvertedEvent,
  LeadCreatedEvent,
  LeadRevertedEvent,
} from '../events/lead-events';
import { LEAD_EVENTS } from '../events/lead-events';

@Injectable()
export class LeadActivityListener {
  constructor(private readonly activityService: ActivityService) {}

  private src(event: { source?: string }) {
    return event.source ? { source: event.source } : {};
  }

  @OnEvent(LEAD_EVENTS.CREATED)
  async handleLeadCreated(event: LeadCreatedEvent) {
    await this.activityService.create({
      activityType: 'lead_created',
      entityType: 'lead',
      entityId: event.leadId,
      actorId: event.actorId,
      metadata: {
        ...(event.prospectId ? { prospectId: event.prospectId } : {}),
        ...this.src(event),
      },
    });
  }

  @OnEvent(LEAD_EVENTS.CONVERTED)
  async handleLeadConverted(event: LeadConvertedEvent) {
    await this.activityService.create({
      activityType: 'lead_converted',
      entityType: 'lead',
      entityId: event.leadId,
      actorId: event.actorId,
      metadata: {
        dealId: event.dealId,
        ...(event.contactId ? { contactId: event.contactId } : {}),
        ...(event.companyId ? { companyId: event.companyId } : {}),
        ...this.src(event),
      },
    });
  }

  @OnEvent(LEAD_EVENTS.REVERTED)
  async handleLeadReverted(event: LeadRevertedEvent) {
    await this.activityService.create({
      activityType: 'lead_reverted',
      entityType: 'lead',
      entityId: event.leadId,
      actorId: event.actorId,
      metadata: {
        ...(event.dealId ? { dealId: event.dealId } : {}),
        ...this.src(event),
      },
    });
  }
}

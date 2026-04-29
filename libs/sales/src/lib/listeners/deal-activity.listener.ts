import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';
import type { ActivityService } from '../services/activity.service';
import type {
  DealCreatedEvent,
  DealStageChangedEvent,
  DealClosedEvent,
  DealFieldUpdatedEvent,
  DealOwnerAssignedEvent,
  DealOwnerRemovedEvent,
  DealCompanyLinkedEvent,
  DealCompanyUnlinkedEvent,
  DealContactLinkedEvent,
  DealContactUnlinkedEvent} from '../events/deal-events';
import {
  DEAL_EVENTS
} from '../events/deal-events';

@Injectable()
export class DealActivityListener {
  constructor(private readonly activityService: ActivityService) {}

  private src(event: { source?: 'ai' }) {
    return event.source ? { source: event.source } : {};
  }

  @OnEvent(DEAL_EVENTS.CREATED)
  async handleDealCreated(event: DealCreatedEvent) {
    await this.activityService.create({
      activityType: 'deal_created',
      entityType: 'deal',
      entityId: event.dealId,
      actorId: event.actorId,
      metadata: { ...this.src(event) },
    });
  }

  @OnEvent(DEAL_EVENTS.STAGE_CHANGED)
  async handleStageChanged(event: DealStageChangedEvent) {
    await this.activityService.create({
      activityType: 'stage_change',
      entityType: 'deal',
      entityId: event.dealId,
      actorId: event.actorId,
      metadata: { from: event.from, to: event.to, ...this.src(event) },
    });
  }

  @OnEvent(DEAL_EVENTS.CLOSED)
  async handleDealClosed(event: DealClosedEvent) {
    await this.activityService.create({
      activityType: 'deal_closed',
      entityType: 'deal',
      entityId: event.dealId,
      actorId: event.actorId,
      metadata: { outcome: event.outcome, lostReason: event.lostReason, ...this.src(event) },
    });
  }

  @OnEvent(DEAL_EVENTS.FIELD_UPDATED)
  async handleFieldUpdated(event: DealFieldUpdatedEvent) {
    await this.activityService.create({
      activityType: 'field_update',
      entityType: 'deal',
      entityId: event.dealId,
      actorId: event.actorId,
      metadata: { field: event.field, from: event.from as Prisma.InputJsonValue, to: event.to as Prisma.InputJsonValue, ...this.src(event) },
    });
  }

  @OnEvent(DEAL_EVENTS.OWNER_ASSIGNED)
  async handleOwnerAssigned(event: DealOwnerAssignedEvent) {
    await this.activityService.create({
      activityType: 'owner_assigned',
      entityType: 'deal',
      entityId: event.dealId,
      actorId: event.actorId,
      metadata: { userId: event.userId, userName: event.userName, ...this.src(event) },
    });
  }

  @OnEvent(DEAL_EVENTS.OWNER_REMOVED)
  async handleOwnerRemoved(event: DealOwnerRemovedEvent) {
    await this.activityService.create({
      activityType: 'owner_removed',
      entityType: 'deal',
      entityId: event.dealId,
      actorId: event.actorId,
      metadata: { userId: event.userId, userName: event.userName, ...this.src(event) },
    });
  }

  @OnEvent(DEAL_EVENTS.COMPANY_LINKED)
  async handleCompanyLinked(event: DealCompanyLinkedEvent) {
    await this.activityService.create({
      activityType: 'company_linked',
      entityType: 'deal',
      entityId: event.dealId,
      actorId: event.actorId,
      metadata: { companyId: event.companyId, companyName: event.companyName, ...this.src(event) },
    });
  }

  @OnEvent(DEAL_EVENTS.COMPANY_UNLINKED)
  async handleCompanyUnlinked(event: DealCompanyUnlinkedEvent) {
    await this.activityService.create({
      activityType: 'company_unlinked',
      entityType: 'deal',
      entityId: event.dealId,
      actorId: event.actorId,
      metadata: { companyId: event.companyId, companyName: event.companyName, ...this.src(event) },
    });
  }

  @OnEvent(DEAL_EVENTS.CONTACT_LINKED)
  async handleContactLinked(event: DealContactLinkedEvent) {
    await this.activityService.create({
      activityType: 'contact_linked',
      entityType: 'deal',
      entityId: event.dealId,
      actorId: event.actorId,
      metadata: {
        contactId: event.contactId,
        contactName: event.contactName,
        ...(event.role && { role: event.role }),
        ...this.src(event),
      },
    });
  }

  @OnEvent(DEAL_EVENTS.CONTACT_UNLINKED)
  async handleContactUnlinked(event: DealContactUnlinkedEvent) {
    await this.activityService.create({
      activityType: 'contact_unlinked',
      entityType: 'deal',
      entityId: event.dealId,
      actorId: event.actorId,
      metadata: { contactId: event.contactId, contactName: event.contactName, ...this.src(event) },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';
import type { ActivityService } from '../services/activity.service';
import type {
  CompanyCreatedEvent,
  CompanyFieldUpdatedEvent,
  CompanyOwnerAssignedEvent,
  CompanyOwnerRemovedEvent,
  CompanyContactLinkedEvent,
  CompanyContactUnlinkedEvent,
} from '../events/company-events';
import { COMPANY_EVENTS } from '../events/company-events';

@Injectable()
export class CompanyActivityListener {
  constructor(private readonly activityService: ActivityService) {}

  private src(event: { source?: string }) {
    return event.source ? { source: event.source } : {};
  }

  @OnEvent(COMPANY_EVENTS.CREATED)
  async handleCompanyCreated(event: CompanyCreatedEvent) {
    await this.activityService.create({
      activityType: 'company_created',
      entityType: 'company',
      entityId: event.companyId,
      actorId: event.actorId,
      metadata: { ...this.src(event) },
    });
  }

  @OnEvent(COMPANY_EVENTS.FIELD_UPDATED)
  async handleFieldUpdated(event: CompanyFieldUpdatedEvent) {
    await this.activityService.create({
      activityType: 'field_update',
      entityType: 'company',
      entityId: event.companyId,
      actorId: event.actorId,
      metadata: {
        field: event.field,
        from: event.from as Prisma.InputJsonValue,
        to: event.to as Prisma.InputJsonValue,
        ...this.src(event),
      },
    });
  }

  @OnEvent(COMPANY_EVENTS.OWNER_ASSIGNED)
  async handleOwnerAssigned(event: CompanyOwnerAssignedEvent) {
    await this.activityService.create({
      activityType: 'owner_assigned',
      entityType: 'company',
      entityId: event.companyId,
      actorId: event.actorId,
      metadata: {
        userId: event.userId,
        userName: event.userName,
        ...this.src(event),
      },
    });
  }

  @OnEvent(COMPANY_EVENTS.OWNER_REMOVED)
  async handleOwnerRemoved(event: CompanyOwnerRemovedEvent) {
    await this.activityService.create({
      activityType: 'owner_removed',
      entityType: 'company',
      entityId: event.companyId,
      actorId: event.actorId,
      metadata: {
        userId: event.userId,
        userName: event.userName,
        ...this.src(event),
      },
    });
  }

  @OnEvent(COMPANY_EVENTS.CONTACT_LINKED)
  async handleContactLinked(event: CompanyContactLinkedEvent) {
    await this.activityService.create({
      activityType: 'contact_linked',
      entityType: 'company',
      entityId: event.companyId,
      actorId: event.actorId,
      metadata: {
        contactId: event.contactId,
        contactName: event.contactName,
        ...(event.role && { role: event.role }),
        ...this.src(event),
      },
    });
  }

  @OnEvent(COMPANY_EVENTS.CONTACT_UNLINKED)
  async handleContactUnlinked(event: CompanyContactUnlinkedEvent) {
    await this.activityService.create({
      activityType: 'contact_unlinked',
      entityType: 'company',
      entityId: event.companyId,
      actorId: event.actorId,
      metadata: {
        contactId: event.contactId,
        contactName: event.contactName,
        ...this.src(event),
      },
    });
  }
}

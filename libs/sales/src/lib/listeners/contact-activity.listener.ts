import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';
import type { ActivityService } from '../services/activity.service';
import type {
  ContactCreatedEvent,
  ContactFieldUpdatedEvent,
  ContactOwnerAssignedEvent,
  ContactOwnerRemovedEvent,
} from '../events/contact-events';
import { CONTACT_EVENTS } from '../events/contact-events';

@Injectable()
export class ContactActivityListener {
  constructor(private readonly activityService: ActivityService) {}

  private src(event: { source?: string }) {
    return event.source ? { source: event.source } : {};
  }

  @OnEvent(CONTACT_EVENTS.CREATED)
  async handleContactCreated(event: ContactCreatedEvent) {
    await this.activityService.create({
      activityType: 'contact_created',
      entityType: 'contact',
      entityId: event.contactId,
      actorId: event.actorId,
      metadata: { ...this.src(event) },
    });
  }

  @OnEvent(CONTACT_EVENTS.FIELD_UPDATED)
  async handleFieldUpdated(event: ContactFieldUpdatedEvent) {
    await this.activityService.create({
      activityType: 'field_update',
      entityType: 'contact',
      entityId: event.contactId,
      actorId: event.actorId,
      metadata: {
        field: event.field,
        from: event.from as Prisma.InputJsonValue,
        to: event.to as Prisma.InputJsonValue,
        ...this.src(event),
      },
    });
  }

  @OnEvent(CONTACT_EVENTS.OWNER_ASSIGNED)
  async handleOwnerAssigned(event: ContactOwnerAssignedEvent) {
    await this.activityService.create({
      activityType: 'owner_assigned',
      entityType: 'contact',
      entityId: event.contactId,
      actorId: event.actorId,
      metadata: {
        userId: event.userId,
        userName: event.userName,
        ...this.src(event),
      },
    });
  }

  @OnEvent(CONTACT_EVENTS.OWNER_REMOVED)
  async handleOwnerRemoved(event: ContactOwnerRemovedEvent) {
    await this.activityService.create({
      activityType: 'owner_removed',
      entityType: 'contact',
      entityId: event.contactId,
      actorId: event.actorId,
      metadata: {
        userId: event.userId,
        userName: event.userName,
        ...this.src(event),
      },
    });
  }
}

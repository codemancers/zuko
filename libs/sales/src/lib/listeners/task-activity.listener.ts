import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { ActivityService } from '../services/activity.service';
import {
  TASK_EVENTS,
  TaskCreatedEvent,
  TaskStatusChangedEvent,
  TaskFieldUpdatedEvent,
  TaskSubtaskAddedEvent,
} from '../events/task-events';

@Injectable()
export class TaskActivityListener {
  constructor(private readonly activityService: ActivityService) {}

  @OnEvent(TASK_EVENTS.CREATED)
  async handleTaskCreated(event: TaskCreatedEvent) {
    await this.activityService.create({
      activityType: 'task_created',
      entityType: 'task',
      entityId: event.taskId,
      actorId: event.actorId,
      metadata: {},
    });
  }

  @OnEvent(TASK_EVENTS.STATUS_CHANGED)
  async handleStatusChanged(event: TaskStatusChangedEvent) {
    await this.activityService.create({
      activityType: 'task_status_changed',
      entityType: 'task',
      entityId: event.taskId,
      actorId: event.actorId,
      metadata: { from: event.from, to: event.to },
    });
  }

  @OnEvent(TASK_EVENTS.FIELD_UPDATED)
  async handleFieldUpdated(event: TaskFieldUpdatedEvent) {
    await this.activityService.create({
      activityType: 'field_update',
      entityType: 'task',
      entityId: event.taskId,
      actorId: event.actorId,
      metadata: {
        field: event.field,
        from: event.from as Prisma.InputJsonValue,
        to: event.to as Prisma.InputJsonValue,
      },
    });
  }

  @OnEvent(TASK_EVENTS.SUBTASK_ADDED)
  async handleSubtaskAdded(event: TaskSubtaskAddedEvent) {
    await this.activityService.create({
      activityType: 'subtask_added',
      entityType: 'task',
      entityId: event.taskId,
      actorId: event.actorId,
      metadata: { subtaskId: event.subtaskId, subtaskTitle: event.subtaskTitle },
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { PaginationOptions } from '../repositories/types';
import type {
  TaskRepository,
  CreateTaskInput,
  UpdateTaskInput,
  TaskPriority,
} from '../repositories/task.repository';
import { TaskStatus } from '../repositories/task.repository';
import type {
  TaskCreatedEvent,
  TaskStatusChangedEvent,
  TaskFieldUpdatedEvent,
  TaskSubtaskAddedEvent,
} from '../events/task-events';
import { TASK_EVENTS } from '../events/task-events';

@Injectable()
export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createTask(
    organizationId: number,
    dto: Omit<CreateTaskInput, 'organizationId'>,
    actorId?: number,
  ) {
    const result = await this.taskRepository.create({ ...dto, organizationId });
    await this.eventEmitter.emitAsync(TASK_EVENTS.CREATED, {
      taskId: result.id,
      actorId,
    } satisfies TaskCreatedEvent);

    if (result.parentId) {
      await this.eventEmitter.emitAsync(TASK_EVENTS.SUBTASK_ADDED, {
        taskId: result.parentId,
        actorId,
        subtaskId: result.id,
        subtaskTitle: result.title,
      } satisfies TaskSubtaskAddedEvent);
    }

    return result;
  }

  async getTasks(
    organizationId: number,
    query: PaginationOptions & {
      parentId?: number | null;
      search?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
    } = {},
  ) {
    return this.taskRepository.findAll(organizationId, query);
  }

  async getTaskById(organizationId: number, id: number) {
    const task = await this.taskRepository.findById(id, organizationId);
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    return task;
  }

  async updateTask(
    organizationId: number,
    id: number,
    dto: UpdateTaskInput,
    actorId?: number,
  ) {
    const current = await this.getTaskById(organizationId, id);
    const updated = await this.taskRepository.update(id, organizationId, dto);

    if (dto.status !== undefined && dto.status !== current.status) {
      await this.eventEmitter.emitAsync(TASK_EVENTS.STATUS_CHANGED, {
        taskId: id,
        actorId,
        from: current.status,
        to: dto.status,
      } satisfies TaskStatusChangedEvent);
    }

    // Assignment may be written by stable ID, so its change is derived from
    // the persisted display names rather than the caller-supplied string.
    const assigneeName = (task: typeof current) =>
      task.assigneeUser?.name ?? task.assignee ?? null;
    const assignmentChanged =
      (dto.assignee !== undefined || dto.assigneeUserId !== undefined) &&
      (assigneeName(current) !== assigneeName(updated) ||
        current.assigneeUserId !== updated.assigneeUserId);

    const trackedFields = [
      'title',
      'description',
      'assignee',
      'priority',
    ] as const;
    for (const field of trackedFields) {
      const isAssignee = field === 'assignee';
      const newVal = isAssignee ? assigneeName(updated) : dto[field];
      const oldVal = isAssignee ? assigneeName(current) : current[field];
      const changed = isAssignee
        ? assignmentChanged
        : newVal !== undefined && newVal !== oldVal;
      if (changed) {
        await this.eventEmitter.emitAsync(TASK_EVENTS.FIELD_UPDATED, {
          taskId: id,
          actorId,
          field,
          from: oldVal ?? null,
          to: newVal ?? null,
        } satisfies TaskFieldUpdatedEvent);
      }
    }

    if (
      dto.status === TaskStatus.DONE &&
      dto.completedAt &&
      updated.subtasks.length > 0
    ) {
      await this.taskRepository.updateSubtasksCompletedAt(id, dto.completedAt);
    }

    return updated;
  }

  async deleteTask(organizationId: number, id: number) {
    await this.getTaskById(organizationId, id);
    return this.taskRepository.delete(id, organizationId);
  }
}

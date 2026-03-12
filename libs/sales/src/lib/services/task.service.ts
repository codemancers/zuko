import { Injectable, NotFoundException } from '@nestjs/common';
import type { PaginationOptions } from '../repositories/types';
import {
  TaskRepository,
  CreateTaskInput,
  UpdateTaskInput,
  TaskStatus,
} from '../repositories/task.repository';

@Injectable()
export class TaskService {
  constructor(private readonly taskRepository: TaskRepository) {}

  async createTask(
    organizationId: number,
    dto: Omit<CreateTaskInput, 'organizationId'>,
  ) {
    return this.taskRepository.create({ ...dto, organizationId });
  }

  async getTasks(
    organizationId: number,
    query: PaginationOptions & { parentId?: number | null } = {},
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
  ) {
    await this.getTaskById(organizationId, id);
    const updated = await this.taskRepository.update(id, organizationId, dto);

    // Cascade completedAt to subtasks when parent is marked DONE
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

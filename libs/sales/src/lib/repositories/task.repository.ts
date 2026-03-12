import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import type { PrismaService } from '../modules/prisma.types';
import type { PaginationOptions } from './types';

export { TaskStatus };

export interface CreateTaskInput {
  organizationId: number;
  title: string;
  description?: string;
  status?: TaskStatus;
  completedAt?: Date;
  parentId?: number;
  assignee?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  completedAt?: Date | null;
  parentId?: number | null;
  assignee?: string | null;
}

@Injectable()
export class TaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateTaskInput) {
    const { organizationId, ...data } = input;
    return this.prisma.task.create({
      data: { ...data, organizationId },
      include: { subtasks: true },
    });
  }

  async findById(id: number, organizationId: number) {
    return this.prisma.task.findFirst({
      where: { id, organizationId },
      include: { subtasks: true },
    });
  }

  async findAll(
    organizationId: number,
    options: PaginationOptions & { parentId?: number | null } = {},
  ) {
    const { page = 1, limit = 50, parentId } = options;
    const skip = (page - 1) * limit;

    // When parentId is explicitly null, return top-level tasks with subtasks.
    // When parentId is a number, return children of that parent.
    const where =
      parentId === undefined
        ? { organizationId, parentId: null }
        : { organizationId, parentId };

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { subtasks: true },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: number, organizationId: number, input: UpdateTaskInput) {
    return this.prisma.task.update({
      where: { id },
      data: input,
      include: { subtasks: true },
    });
  }

  async delete(id: number, organizationId: number) {
    return this.prisma.task.delete({
      where: { id },
    });
  }

  async updateSubtasksCompletedAt(parentId: number, completedAt: Date) {
    return this.prisma.task.updateMany({
      where: { parentId },
      data: { completedAt, status: TaskStatus.DONE },
    });
  }
}

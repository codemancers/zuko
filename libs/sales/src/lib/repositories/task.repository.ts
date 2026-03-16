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
  createdBy?: string;
  createdByUserId?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  completedAt?: Date | null;
  parentId?: number | null;
  assignee?: string | null;
}

const taskInclude = {
  subtasks: true,
  owners: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
} as const;

@Injectable()
export class TaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateTaskInput) {
    const { organizationId, createdByUserId, ...data } = input;

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: { ...data, organizationId },
        include: taskInclude,
      });

      if (createdByUserId) {
        await tx.taskOwner.create({
          data: { taskId: task.id, userId: createdByUserId, isPrimary: true },
        });

        return tx.task.findUniqueOrThrow({
          where: { id: task.id },
          include: taskInclude,
        });
      }

      return task;
    });
  }

  async findById(id: number, organizationId: number) {
    return this.prisma.task.findFirst({
      where: { id, organizationId },
      include: taskInclude,
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
        include: taskInclude,
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
      include: taskInclude,
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

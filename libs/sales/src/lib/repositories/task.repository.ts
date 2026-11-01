import { BadRequestException, Injectable } from '@nestjs/common';
import { TaskStatus, TaskPriority } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../modules/prisma.types';
import type { PaginationOptions } from './types';
import type { EditorData } from '../types/sales-api';

export { TaskStatus, TaskPriority };

export interface CreateTaskInput {
  organizationId: number;
  title: string;
  description?: EditorData;
  status?: TaskStatus;
  priority?: TaskPriority;
  isSales?: boolean;
  completedAt?: Date;
  parentId?: number;
  /** Legacy display name. Ignored when assigneeUserId is provided. */
  assignee?: string;
  assigneeUserId?: number | null;
  createdByUserId?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: EditorData;
  status?: TaskStatus;
  priority?: TaskPriority;
  isSales?: boolean;
  completedAt?: Date | null;
  parentId?: number | null;
  /** Legacy display name. Ignored when assigneeUserId is provided. */
  assignee?: string | null;
  assigneeUserId?: number | null;
}

type AssignmentInput = Pick<UpdateTaskInput, 'assignee' | 'assigneeUserId'>;

const userSummary = { select: { id: true, name: true, email: true } } as const;

const taskInclude = {
  subtasks: true,
  owners: { include: { user: userSummary } },
  assigneeUser: userSummary,
} as const;

@Injectable()
export class TaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Maps assignment input to columns. A stable user ID must belong to the
   * organization and its display name is resolved here, never taken from the
   * caller. A legacy name-only write drops any stable ID; names are never
   * matched back to users.
   */
  private async resolveAssignment(
    tx: Prisma.TransactionClient,
    organizationId: number,
    { assignee, assigneeUserId }: AssignmentInput,
  ): Promise<{ assignee?: string | null; assigneeUserId?: number | null }> {
    if (assigneeUserId === undefined) {
      return assignee === undefined ? {} : { assignee, assigneeUserId: null };
    }
    if (assigneeUserId === null) {
      return { assigneeUserId: null, assignee: null };
    }

    const member = await tx.member.findFirst({
      where: { organizationId, userId: assigneeUserId },
      select: { user: { select: { id: true, name: true } } },
    });
    if (!member) {
      throw new BadRequestException(
        `Assignee user ${assigneeUserId} is not a member of this organization`,
      );
    }
    return { assigneeUserId: member.user.id, assignee: member.user.name };
  }

  async create(input: CreateTaskInput) {
    const {
      organizationId,
      createdByUserId,
      assignee,
      assigneeUserId,
      ...data
    } = input;

    return this.prisma.$transaction(async (tx) => {
      const assignment = await this.resolveAssignment(tx, organizationId, {
        assignee,
        assigneeUserId,
      });
      const task = await tx.task.create({
        data: { ...data, organizationId, ...assignment },
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
    options: PaginationOptions & {
      parentId?: number | null;
      search?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
    } = {},
  ) {
    const {
      page = 1,
      limit = 50,
      parentId,
      search,
      status,
      priority,
    } = options;
    const skip = (page - 1) * limit;

    const parentFilter =
      parentId === undefined ? { parentId: null } : { parentId };

    const searchFilter = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { assignee: { contains: search, mode: 'insensitive' as const } },
            {
              assigneeUser: {
                name: { contains: search, mode: 'insensitive' as const },
              },
            },
          ],
        }
      : {};

    const statusFilter = status ? { status } : {};
    const priorityFilter = priority ? { priority } : {};

    const where = {
      organizationId,
      ...parentFilter,
      ...searchFilter,
      ...statusFilter,
      ...priorityFilter,
    };

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
    const { assignee, assigneeUserId, ...data } = input;

    return this.prisma.$transaction(async (tx) => {
      const assignment = await this.resolveAssignment(tx, organizationId, {
        assignee,
        assigneeUserId,
      });
      return tx.task.update({
        where: { id, organizationId },
        data: { ...data, ...assignment },
        include: taskInclude,
      });
    });
  }

  async delete(id: number, organizationId: number) {
    return this.prisma.task.delete({
      where: { id, organizationId },
    });
  }

  async updateSubtasksCompletedAt(parentId: number, completedAt: Date) {
    return this.prisma.task.updateMany({
      where: { parentId },
      data: { completedAt, status: TaskStatus.DONE },
    });
  }
}

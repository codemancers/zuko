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
  /** At most one of contactId/prospectId may be set. */
  contactId?: number | null;
  prospectId?: number | null;
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
  /**
   * Setting one person reference clears the other; null clears it; omit to
   * keep it. Sending both non-null is rejected.
   */
  contactId?: number | null;
  prospectId?: number | null;
}

type AssignmentInput = Pick<UpdateTaskInput, 'assignee' | 'assigneeUserId'>;
type PersonReferenceInput = Pick<UpdateTaskInput, 'contactId' | 'prospectId'>;

// Only these plain columns are copied from caller input. Callers spread request
// bodies into the input at runtime, so anything else (nested relation writes,
// organizationId) would otherwise reach Prisma and bypass org validation.
const writableFields = [
  'title',
  'description',
  'status',
  'priority',
  'isSales',
  'completedAt',
  'parentId',
] as const;

type WritableFields = Pick<UpdateTaskInput, (typeof writableFields)[number]>;

function pickWritableFields(input: object): WritableFields {
  return Object.fromEntries(
    Object.entries(input).filter(([key]) =>
      (writableFields as readonly string[]).includes(key),
    ),
  ) as WritableFields;
}

const userSummary = { select: { id: true, name: true, email: true } } as const;
const personSummary = { select: { id: true, name: true } } as const;

const taskInclude = {
  subtasks: true,
  owners: { include: { user: userSummary } },
  assigneeUser: userSummary,
  contact: personSummary,
  prospect: personSummary,
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

  /**
   * Maps the optional person reference to columns. The person must belong to
   * the organization; a prospect is never swapped for its matched contact.
   */
  private async resolvePersonReference(
    tx: Prisma.TransactionClient,
    organizationId: number,
    { contactId, prospectId }: PersonReferenceInput,
  ): Promise<PersonReferenceInput> {
    if (contactId != null && prospectId != null) {
      throw new BadRequestException(
        'A task can reference a contact or a prospect, not both',
      );
    }
    if (contactId != null) {
      const contact = await tx.contact.findFirst({
        where: { id: contactId, organizationId },
        select: { id: true },
      });
      if (!contact) {
        throw new BadRequestException(
          `Contact ${contactId} does not exist in this organization`,
        );
      }
      return { contactId, prospectId: null };
    }
    if (prospectId != null) {
      const prospect = await tx.prospect.findFirst({
        where: { id: prospectId, organizationId },
        select: { id: true },
      });
      if (!prospect) {
        throw new BadRequestException(
          `Prospect ${prospectId} does not exist in this organization`,
        );
      }
      return { prospectId, contactId: null };
    }
    return {
      ...(contactId === null ? { contactId: null } : {}),
      ...(prospectId === null ? { prospectId: null } : {}),
    };
  }

  async create(input: CreateTaskInput) {
    const {
      organizationId,
      createdByUserId,
      assignee,
      assigneeUserId,
      contactId,
      prospectId,
    } = input;
    const data = pickWritableFields(input);

    return this.prisma.$transaction(async (tx) => {
      const personReference = await this.resolvePersonReference(
        tx,
        organizationId,
        { contactId, prospectId },
      );
      const assignment = await this.resolveAssignment(tx, organizationId, {
        assignee,
        assigneeUserId,
      });
      const task = await tx.task.create({
        data: {
          ...data,
          title: input.title,
          organizationId,
          ...assignment,
          ...personReference,
        },
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
    const { assignee, assigneeUserId, contactId, prospectId } = input;
    const data = pickWritableFields(input);

    return this.prisma.$transaction(async (tx) => {
      const personReference = await this.resolvePersonReference(
        tx,
        organizationId,
        { contactId, prospectId },
      );
      const assignment = await this.resolveAssignment(tx, organizationId, {
        assignee,
        assigneeUserId,
      });
      return tx.task.update({
        where: { id, organizationId },
        data: { ...data, ...assignment, ...personReference },
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

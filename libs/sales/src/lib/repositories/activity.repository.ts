import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../modules/prisma.types';

export interface CreateActivityInput {
  activityType: string;
  entityType: string;
  entityId: number;
  actorId?: number;
  content?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface ActivityFilters {
  entityType?: string;
  entityId?: number;
  activityType?: string;
  actorId?: number;
}

export interface ActivityPaginationOptions {
  limit?: number;
  offset?: number;
}

@Injectable()
export class ActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateActivityInput) {
    return this.prisma.activity.create({
      data: input,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });
  }

  async findById(id: number) {
    return this.prisma.activity.findUnique({
      where: { id },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });
  }

  async findAll(
    filters: ActivityFilters = {},
    pagination: ActivityPaginationOptions = {}
  ) {
    const { entityType, entityId, activityType, actorId } = filters;
    const { limit = 50, offset = 0 } = pagination;

    const where: Prisma.ActivityWhereInput = {
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(activityType && { activityType }),
      ...(actorId && { actorId }),
    };

    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return {
      activities,
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }

  async getTimeline(entityType: string, entityId: number, limit = 50) {
    return this.findAll({ entityType, entityId }, { limit });
  }

  async createComment(
    entityType: string,
    entityId: number,
    actorId: number,
    content: string
  ) {
    return this.create({
      activityType: 'comment',
      entityType,
      entityId,
      actorId,
      content,
    });
  }

  async delete(id: number) {
    return this.prisma.activity.delete({
      where: { id },
    });
  }

  async update(id: number, content: string) {
    return this.prisma.activity.update({
      where: { id },
      data: {
        content,
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });
  }
}

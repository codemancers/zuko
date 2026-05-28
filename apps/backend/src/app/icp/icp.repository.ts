import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CreateIcpProfileDto, UpdateIcpProfileDto } from './dto/icp.dto';

@Injectable()
export class IcpRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: number, dto: CreateIcpProfileDto) {
    return this.prisma.icpProfile.create({
      data: {
        organizationId,
        name: dto.name,
        ...(dto.description !== undefined && {
          description: dto.description as Prisma.InputJsonValue,
        }),
        filters: (dto.filters ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async findAll(organizationId: number, page = 1, perPage = 20) {
    const skip = (page - 1) * perPage;
    const where = { organizationId };
    const [data, total] = await Promise.all([
      this.prisma.icpProfile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.icpProfile.count({ where }),
    ]);
    return {
      data,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    };
  }

  findById(id: number, organizationId: number) {
    return this.prisma.icpProfile.findFirst({
      where: { id, organizationId },
    });
  }

  update(id: number, dto: UpdateIcpProfileDto) {
    return this.prisma.icpProfile.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && {
          description: dto.description as Prisma.InputJsonValue,
        }),
        ...(dto.filters !== undefined && {
          filters: dto.filters as Prisma.InputJsonValue,
        }),
        ...(dto.notes !== undefined && {
          notes: dto.notes as Prisma.InputJsonValue,
        }),
      },
    });
  }

  delete(id: number) {
    return this.prisma.icpProfile.delete({ where: { id } });
  }
}

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

  findAll(organizationId: number) {
    return this.prisma.icpProfile.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
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

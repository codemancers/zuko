import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../modules/prisma.types';

export interface UpsertCampaignInput {
  organizationId: number;
  createdById: number;
  name: string;
  providerSequenceId: string;
  active: boolean;
  permissions: string;
  sequence: unknown[];
}

@Injectable()
export class CampaignsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: UpsertCampaignInput) {
    return this.prisma.campaign.upsert({
      where: {
        organizationId_providerSequenceId: {
          organizationId: input.organizationId,
          providerSequenceId: input.providerSequenceId,
        },
      },
      create: {
        organizationId: input.organizationId,
        createdById: input.createdById,
        name: input.name,
        providerSequenceId: input.providerSequenceId,
        active: input.active,
        permissions: input.permissions,
        sequence: input.sequence as Prisma.InputJsonValue,
      },
      update: {
        name: input.name,
        active: input.active,
        permissions: input.permissions,
        sequence: input.sequence as Prisma.InputJsonValue,
      },
    });
  }

  async findBySequenceId(organizationId: number, providerSequenceId: string) {
    return this.prisma.campaign.findUnique({
      where: {
        organizationId_providerSequenceId: {
          organizationId,
          providerSequenceId,
        },
      },
    });
  }

  async updateActive(
    organizationId: number,
    providerSequenceId: string,
    active: boolean,
  ) {
    return this.prisma.campaign.update({
      where: {
        organizationId_providerSequenceId: {
          organizationId,
          providerSequenceId,
        },
      },
      data: { active },
    });
  }

  async findAll(organizationId: number) {
    return this.prisma.campaign.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

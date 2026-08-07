import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../modules/prisma.types';

export interface UpsertCampaignInput {
  organizationId: number;
  createdById: number;
  icpProfileId?: number;
  name: string;
  providerSequenceId: string;
  active: boolean;
  permissions: string;
  sequence: unknown[];
}

export interface CreateCampaignMetaInput {
  organizationId: number;
  createdById: number;
  icpProfileId?: number;
  name: string;
}

@Injectable()
export class CampaignsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMeta(input: CreateCampaignMetaInput) {
    return this.prisma.campaign.create({
      data: {
        organizationId: input.organizationId,
        createdById: input.createdById,
        icpProfileId: input.icpProfileId ?? null,
        name: input.name,
        active: false,
        permissions: 'team_can_use',
        sequence: [],
      },
    });
  }

  async findById(id: number, organizationId: number) {
    return this.prisma.campaign.findFirst({
      where: { id, organizationId },
      include: { icpProfile: { select: { id: true, name: true } } },
    });
  }

  async setProviderSequenceId(id: number, providerSequenceId: string) {
    return this.prisma.campaign.update({
      where: { id },
      data: { providerSequenceId },
    });
  }

  async linkProviderSequence(
    id: number,
    providerSequenceId: string,
    sequence: unknown[],
  ) {
    return this.prisma.campaign.update({
      where: { id },
      data: {
        providerSequenceId,
        sequence: sequence as Prisma.InputJsonValue,
      },
    });
  }

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
        icpProfileId: input.icpProfileId ?? null,
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
        ...(input.icpProfileId !== undefined && {
          icpProfileId: input.icpProfileId,
        }),
      },
    });
  }

  async findByIcpProfileId(organizationId: number, icpProfileId: number) {
    return this.prisma.campaign.findMany({
      where: { organizationId, icpProfileId },
      orderBy: { createdAt: 'desc' },
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
      include: { icpProfile: { select: { id: true, name: true } } },
    });
  }
}

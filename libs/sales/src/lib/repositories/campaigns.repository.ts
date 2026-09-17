import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../modules/prisma.types';

/** Campaigns are Apollo sequences today; other systems set this explicitly. */
const DEFAULT_EXTERNAL_TYPE = 'apollo';

export interface UpsertCampaignInput {
  organizationId: number;
  createdById: number;
  icpProfileId?: number;
  name: string;
  /** Which system the campaign lives in — apollo | origami | salesforce | … */
  externalType?: string;
  externalId: string;
  active: boolean;
  permissions: string;
  sequence: unknown[];
}

export interface CreateCampaignMetaInput {
  organizationId: number;
  createdById: number;
  icpProfileId?: number;
  name: string;
  externalType?: string;
  externalId?: string;
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
        externalType: input.externalType ?? DEFAULT_EXTERNAL_TYPE,
        externalId: input.externalId ?? null,
      },
    });
  }

  async findById(id: number, organizationId: number) {
    return this.prisma.campaign.findFirst({
      where: { id, organizationId },
      include: { icpProfile: { select: { id: true, name: true } } },
    });
  }

  async setExternalId(id: number, externalId: string) {
    return this.prisma.campaign.update({
      where: { id },
      data: { externalId },
    });
  }

  async linkExternalSequence(
    id: number,
    externalId: string,
    sequence: unknown[],
  ) {
    return this.prisma.campaign.update({
      where: { id },
      data: {
        externalId,
        sequence: sequence as Prisma.InputJsonValue,
      },
    });
  }

  async upsert(input: UpsertCampaignInput) {
    return this.prisma.campaign.upsert({
      where: {
        organizationId_externalType_externalId: {
          organizationId: input.organizationId,
          externalType: input.externalType ?? DEFAULT_EXTERNAL_TYPE,
          externalId: input.externalId,
        },
      },
      create: {
        organizationId: input.organizationId,
        createdById: input.createdById,
        icpProfileId: input.icpProfileId ?? null,
        name: input.name,
        externalType: input.externalType ?? DEFAULT_EXTERNAL_TYPE,
        externalId: input.externalId,
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

  async findByExternalId(
    organizationId: number,
    externalId: string,
    externalType: string = DEFAULT_EXTERNAL_TYPE,
  ) {
    return this.prisma.campaign.findUnique({
      where: {
        organizationId_externalType_externalId: {
          organizationId,
          externalType,
          externalId,
        },
      },
    });
  }

  async updateActive(
    organizationId: number,
    externalId: string,
    active: boolean,
    externalType: string = DEFAULT_EXTERNAL_TYPE,
  ) {
    return this.prisma.campaign.update({
      where: {
        organizationId_externalType_externalId: {
          organizationId,
          externalType,
          externalId,
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

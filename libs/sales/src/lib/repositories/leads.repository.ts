import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../modules/prisma.types';

export interface CreateLeadInput {
  organizationId: number;
  icpProfileId: number;
  campaignId?: number;
  contactId?: number;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  title?: string;
  linkedinUrl?: string;
  status?: string;
  source?: string;
  apolloPersonId?: string;
  notes?: string;
  metadata?: unknown;
}

export interface UpdateLeadInput {
  contactId?: number | null;
  dealId?: number | null;
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  title?: string;
  linkedinUrl?: string;
  status?: string;
  notes?: string;
  metadata?: unknown;
}

export interface LeadFilters {
  search?: string;
  icpProfileId?: number;
  campaignId?: number;
  status?: string[];
  source?: string[];
}

const defaultInclude = {
  icpProfile: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true } },
  contact: { select: { id: true, name: true, email: true } },
  deal: { select: { id: true, title: true } },
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: number,
    filters: LeadFilters = {},
    page = 1,
    perPage = 50,
  ) {
    const skip = (page - 1) * perPage;
    const where: Prisma.LeadWhereInput = {
      organizationId,
      ...(filters.icpProfileId ? { icpProfileId: filters.icpProfileId } : {}),
      ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
      ...(filters.status?.length ? { status: { in: filters.status } } : {}),
      ...(filters.source?.length ? { source: { in: filters.source } } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { email: { contains: filters.search, mode: 'insensitive' } },
              {
                companyName: { contains: filters.search, mode: 'insensitive' },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: defaultInclude,
      }),
      this.prisma.lead.count({ where }),
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
    return this.prisma.lead.findFirst({
      where: { id, organizationId },
      include: defaultInclude,
    });
  }

  findByApolloPersonId(organizationId: number, apolloPersonId: string) {
    return this.prisma.lead.findFirst({
      where: { organizationId, apolloPersonId },
    });
  }

  create(input: CreateLeadInput) {
    const { metadata, ...rest } = input;
    return this.prisma.lead.create({
      data: {
        ...rest,
        ...(metadata !== undefined
          ? { metadata: metadata as Prisma.InputJsonValue }
          : {}),
      },
      include: defaultInclude,
    });
  }

  update(id: number, input: UpdateLeadInput) {
    const { metadata, ...rest } = input;
    return this.prisma.lead.update({
      where: { id },
      data: {
        ...rest,
        ...(metadata !== undefined
          ? { metadata: metadata as Prisma.InputJsonValue }
          : {}),
      },
      include: defaultInclude,
    });
  }

  delete(id: number) {
    return this.prisma.lead.delete({ where: { id } });
  }
}

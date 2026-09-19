import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../modules/prisma.types';

export interface CreateProspectInput {
  organizationId: number;
  icpProfileId?: number;
  contactId?: number;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  title?: string;
  linkedinUrl?: string;
  externalType?: string;
  externalId?: string;
  status?: string;
  source?: string;
  emailConsent?: string;
  linkedinConsent?: string;
  phoneConsent?: string;
  notes?: unknown;
  metadata?: unknown;
}

export interface UpdateProspectInput {
  icpProfileId?: number | null;
  contactId?: number | null;
  leadId?: number | null;
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  title?: string;
  linkedinUrl?: string;
  externalType?: string;
  externalId?: string;
  status?: string;
  emailConsent?: string;
  linkedinConsent?: string;
  phoneConsent?: string;
  notes?: unknown;
  metadata?: unknown;
}

export interface ProspectFilters {
  search?: string;
  icpProfileId?: number;
  campaignId?: number;
  status?: string[];
  source?: string[];
  engagement?: string[];
}

export interface ProspectIdentity {
  email?: string | null;
  /** Which system externalId belongs to — apollo | origami | salesforce | … */
  externalType?: string | null;
  externalId?: string | null;
  linkedinUrl?: string | null;
}

export interface CreateMembershipInput {
  prospectId: number;
  campaignId: number;
  state?: string;
  engagement?: string;
  channel?: string;
  enrolledAt?: Date | null;
  metadata?: unknown;
}

export interface UpdateMembershipInput {
  state?: string;
  engagement?: string;
  disposition?: string | null;
  channel?: string;
  enrolledAt?: Date | null;
  closedAt?: Date | null;
  nextEligibleAt?: Date | null;
  metadata?: unknown;
}

export interface RecordEventInput {
  /** Optional: a touch outside any campaign belongs to the prospect alone. */
  membershipId?: number;
  prospectId: number;
  channel?: string;
  direction?: string;
  eventType: string;
  occurredAt?: Date;
  payload?: unknown;
  externalId?: string;
  /** Who caused it — null when a provider or scheduler did. */
  actorId?: number;
  /** system | user | agent | provider */
  source?: string;
}

const membershipInclude = {
  campaign: { select: { id: true, name: true, externalType: true } },
} satisfies Prisma.CampaignMembershipInclude;

const defaultInclude = {
  icpProfile: { select: { id: true, name: true } },
  contact: { select: { id: true, name: true, email: true } },
  lead: { select: { id: true, name: true, status: true } },
  memberships: {
    include: membershipInclude,
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.ProspectInclude;

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

@Injectable()
export class ProspectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: number,
    filters: ProspectFilters = {},
    page = 1,
    perPage = 50,
  ) {
    const skip = (page - 1) * perPage;
    const where: Prisma.ProspectWhereInput = {
      organizationId,
      ...(filters.icpProfileId ? { icpProfileId: filters.icpProfileId } : {}),
      ...(filters.status?.length ? { status: { in: filters.status } } : {}),
      ...(filters.source?.length ? { source: { in: filters.source } } : {}),
      ...(filters.campaignId || filters.engagement?.length
        ? {
            memberships: {
              some: {
                ...(filters.campaignId
                  ? { campaignId: filters.campaignId }
                  : {}),
                ...(filters.engagement?.length
                  ? { engagement: { in: filters.engagement } }
                  : {}),
              },
            },
          }
        : {}),
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
      this.prisma.prospect.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: defaultInclude,
      }),
      this.prisma.prospect.count({ where }),
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
    return this.prisma.prospect.findFirst({
      where: { id, organizationId },
      include: defaultInclude,
    });
  }

  /**
   * Identity resolution: match an inbound person against a prospect we already
   * hold, in priority order — provider id, then email, then LinkedIn.
   * Returns null when nothing matches, so the caller creates a new record.
   */
  async findByIdentity(organizationId: number, identity: ProspectIdentity) {
    const { externalType, externalId, email, linkedinUrl } = identity;

    // An id is only meaningful alongside the system it came from: Apollo
    // "12345" and Salesforce "12345" are different people.
    if (externalType && externalId) {
      const match = await this.prisma.prospect.findFirst({
        where: { organizationId, externalType, externalId },
        include: defaultInclude,
      });
      if (match) return match;
    }

    if (email) {
      const match = await this.prisma.prospect.findFirst({
        where: { organizationId, email },
        include: defaultInclude,
      });
      if (match) return match;
    }

    if (linkedinUrl) {
      const match = await this.prisma.prospect.findFirst({
        where: { organizationId, linkedinUrl },
        include: defaultInclude,
      });
      if (match) return match;
    }

    return null;
  }

  /** The matching CRM contact, so a known customer is never duplicated. */
  findMatchingContact(organizationId: number, identity: ProspectIdentity) {
    const or: Prisma.ContactWhereInput[] = [];
    if (identity.externalType && identity.externalId) {
      or.push({
        externalType: identity.externalType,
        externalId: identity.externalId,
      });
    }
    if (identity.email) or.push({ email: identity.email });
    if (identity.linkedinUrl) or.push({ linkedinId: identity.linkedinUrl });
    if (or.length === 0) return Promise.resolve(null);

    return this.prisma.contact.findFirst({
      where: { organizationId, OR: or },
    });
  }

  create(input: CreateProspectInput) {
    const { metadata, notes, ...rest } = input;
    return this.prisma.prospect.create({
      data: {
        ...rest,
        ...(notes !== undefined ? { notes: asJson(notes) } : {}),
        ...(metadata !== undefined ? { metadata: asJson(metadata) } : {}),
      },
      include: defaultInclude,
    });
  }

  update(id: number, input: UpdateProspectInput) {
    const { metadata, notes, ...rest } = input;
    return this.prisma.prospect.update({
      where: { id },
      data: {
        ...rest,
        ...(notes !== undefined ? { notes: asJson(notes) } : {}),
        ...(metadata !== undefined ? { metadata: asJson(metadata) } : {}),
      },
      include: defaultInclude,
    });
  }

  delete(id: number) {
    return this.prisma.prospect.delete({ where: { id } });
  }

  // ---- Campaign memberships ----

  findMembership(id: number) {
    return this.prisma.campaignMembership.findUnique({
      where: { id },
      include: { ...membershipInclude, prospect: true },
    });
  }

  findMemberships(prospectId: number) {
    return this.prisma.campaignMembership.findMany({
      where: { prospectId },
      include: membershipInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  findOpenMemberships(prospectId: number, openStates: readonly string[]) {
    return this.prisma.campaignMembership.findMany({
      where: { prospectId, state: { in: [...openStates] } },
      include: membershipInclude,
    });
  }

  findOpenMembershipForCampaign(
    prospectId: number,
    campaignId: number,
    openStates: readonly string[],
  ) {
    return this.prisma.campaignMembership.findFirst({
      where: { prospectId, campaignId, state: { in: [...openStates] } },
    });
  }

  /** The membership whose cooldown, if any, still blocks re-enrolment. */
  findCoolingOffMembership(prospectId: number) {
    return this.prisma.campaignMembership.findFirst({
      where: { prospectId, nextEligibleAt: { gt: new Date() } },
      orderBy: { nextEligibleAt: 'desc' },
    });
  }

  createMembership(input: CreateMembershipInput) {
    const { metadata, ...rest } = input;
    return this.prisma.campaignMembership.create({
      data: {
        ...rest,
        ...(metadata !== undefined ? { metadata: asJson(metadata) } : {}),
      },
      include: membershipInclude,
    });
  }

  updateMembership(id: number, input: UpdateMembershipInput) {
    const { metadata, ...rest } = input;
    return this.prisma.campaignMembership.update({
      where: { id },
      data: {
        ...rest,
        ...(metadata !== undefined ? { metadata: asJson(metadata) } : {}),
      },
      include: membershipInclude,
    });
  }

  // ---- Events ----

  recordEvent(input: RecordEventInput) {
    const { payload, occurredAt, ...rest } = input;
    return this.prisma.campaignEvent.create({
      data: {
        ...rest,
        occurredAt: occurredAt ?? new Date(),
        ...(payload !== undefined ? { payload: asJson(payload) } : {}),
      },
    });
  }

  findEventByExternalId(membershipId: number, externalId: string) {
    return this.prisma.campaignEvent.findFirst({
      where: { membershipId, externalId },
    });
  }

  findEvents(prospectId: number, take = 100) {
    return this.prisma.campaignEvent.findMany({
      where: { prospectId },
      orderBy: { occurredAt: 'desc' },
      take,
    });
  }

  /** Status counts for an organization, for list filters and analytics. */
  async countByStatus(organizationId: number) {
    const grouped = await this.prisma.prospect.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: { id: true },
    });

    return grouped.map((g) => ({ status: g.status, count: g._count.id }));
  }
}

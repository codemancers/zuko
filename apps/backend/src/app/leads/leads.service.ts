import { Injectable, NotFoundException } from '@nestjs/common';
import { LeadsRepository } from '@zuko/sales';
import type {
  CreateLeadDto,
  UpdateLeadDto,
  ListLeadsQueryDto,
} from './dto/leads.dto';
import type { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly leadsRepository: LeadsRepository,
    private readonly prisma: PrismaService,
  ) {}

  findAll(organizationId: number, query: ListLeadsQueryDto) {
    const status = query.status
      ? Array.isArray(query.status)
        ? query.status
        : [query.status]
      : undefined;
    const source = query.source
      ? Array.isArray(query.source)
        ? query.source
        : [query.source]
      : undefined;
    return this.leadsRepository.findAll(
      organizationId,
      {
        search: query.search,
        icpProfileId: query.icpProfileId,
        campaignId: query.campaignId,
        status,
        source,
      },
      query.page ?? 1,
      query.perPage ?? 50,
    );
  }

  async findById(id: number, organizationId: number) {
    const lead = await this.leadsRepository.findById(id, organizationId);
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }

  create(organizationId: number, dto: CreateLeadDto) {
    return this.leadsRepository.create({ ...dto, organizationId });
  }

  async update(id: number, organizationId: number, dto: UpdateLeadDto) {
    await this.findById(id, organizationId);
    return this.leadsRepository.update(id, dto);
  }

  async delete(id: number, organizationId: number) {
    await this.findById(id, organizationId);
    return this.leadsRepository.delete(id);
  }

  async convert(id: number, organizationId: number) {
    const lead = await this.findById(id, organizationId);

    // Upsert contact by email
    let contact = lead.contact;
    if (!contact && lead.email) {
      const existing = await this.prisma.contact.findFirst({
        where: { organizationId, email: lead.email },
      });
      contact =
        existing ??
        (await this.prisma.contact.create({
          data: {
            organizationId,
            name: lead.name,
            email: lead.email,
            phone: lead.phone ?? undefined,
            linkedinId: lead.linkedinUrl ?? undefined,
          },
        }));
    }

    // Upsert company by name
    let company = null;
    if (lead.companyName) {
      const existing = await this.prisma.company.findFirst({
        where: { organizationId, companyName: lead.companyName },
      });
      company =
        existing ??
        (await this.prisma.company.create({
          data: { organizationId, companyName: lead.companyName },
        }));
    }

    // Create deal
    const deal = await this.prisma.deal.create({
      data: {
        organizationId,
        title: lead.name,
        source: lead.source,
        ...(contact
          ? { contacts: { create: { contactId: contact.id, isPrimary: true } } }
          : {}),
        ...(company
          ? {
              companies: { create: { companyId: company.id, isPrimary: true } },
            }
          : {}),
      },
    });

    // Link lead to deal, mark converted
    await this.leadsRepository.update(id, {
      dealId: deal.id,
      contactId: contact?.id ?? undefined,
      status: 'converted',
    });

    return { deal, contact, company };
  }
}

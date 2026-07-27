import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../modules/prisma.types';
import type { PaginationOptions } from './types';
import type { EditorData } from '../types/sales-api';

export interface CreateCompanyInput {
  organizationId: number;
  companyName: string;
  website?: string;
  linkedinUrl?: string;
  summary?: EditorData;
  ownerIds?: number[];
  primaryOwnerId?: number;
  fields?: Record<string, unknown>;
  apolloOrganizationId?: string;
  apolloAccountId?: string;
}

export interface UpdateCompanyInput {
  companyName?: string;
  website?: string;
  linkedinUrl?: string;
  summary?: EditorData;
  isHidden?: boolean;
  fields?: Record<string, unknown>;
  apolloOrganizationId?: string;
  apolloAccountId?: string;
}

export interface CompanyFilters {
  organizationId: number;
  isHidden?: boolean;
  ownerIds?: number[];
  search?: string;
  companyIds?: number[];
}

export interface AddContactToCompanyInput {
  contactId: number;
  role?: string;
  isPrimary?: boolean;
  joinedAt?: Date;
}

export interface UpdateContactCompanyInput {
  role?: string;
  isPrimary?: boolean;
}

@Injectable()
export class CompaniesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateCompanyInput) {
    const {
      ownerIds,
      primaryOwnerId,
      organizationId,
      fields: inputFields,
      ...otherData
    } = input;

    const fields = (inputFields || {}) as Prisma.InputJsonValue;

    const actualPrimaryId =
      primaryOwnerId ??
      (ownerIds && ownerIds.length > 0 ? ownerIds[0] : undefined);

    return this.prisma.company.create({
      data: {
        ...otherData,
        organizationId,
        fields,
        ...(ownerIds && ownerIds.length > 0
          ? {
              owners: {
                create: ownerIds.map((userId) => ({
                  userId,
                  isPrimary: userId === actualPrimaryId,
                })),
              },
            }
          : {}),
      },
      include: {
        owners: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  async findByApolloOrganizationId(
    apolloOrganizationId: string,
    organizationId: number,
  ) {
    return this.prisma.company.findFirst({
      where: { apolloOrganizationId, organizationId },
    });
  }

  async findById(id: number, organizationId: number) {
    return this.prisma.company.findFirst({
      where: { id, organizationId },
      include: {
        owners: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        contacts: {
          where: {
            leftAt: null, // Only active contacts by default
          },
          include: {
            contact: {
              include: {
                owners: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            joinedAt: 'desc',
          },
        },
      },
    });
  }

  async update(id: number, input: UpdateCompanyInput) {
    const { fields: existingFields, ...otherData } = input;

    return this.prisma.company.update({
      where: { id },
      data: {
        ...otherData,
        ...(existingFields !== undefined
          ? { fields: existingFields as Prisma.InputJsonValue }
          : {}),
      },
      include: {
        owners: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  async hide(id: number) {
    return this.update(id, { isHidden: true });
  }

  async unhide(id: number) {
    return this.update(id, { isHidden: false });
  }

  async findAll(filters: CompanyFilters, pagination: PaginationOptions = {}) {
    const {
      organizationId,
      isHidden = false,
      ownerIds,
      search,
      companyIds,
    } = filters;
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.CompanyWhereInput = {
      organizationId,
      isHidden,
      ...(companyIds && companyIds.length > 0
        ? { id: { in: companyIds } }
        : {}),
      ...(ownerIds && ownerIds.length > 0
        ? {
            owners: {
              some: {
                userId: {
                  in: ownerIds,
                },
              },
            },
          }
        : {}),
    };

    if (search) {
      // Get dynamic field keys to include them in the OR search for precise value matching
      const customColumns = await this.prisma.tableColumn.findMany({
        where: { organizationId, tableName: 'companies' },
        select: { columnKey: true },
      });

      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { website: { contains: search, mode: 'insensitive' } },
        { linkedinUrl: { contains: search, mode: 'insensitive' } },
        ...customColumns.map((col) => ({
          fields: {
            path: [col.columnKey],
            string_contains: search,
          },
        })),
        // Fallback global search across the entire JSON blob
        { fields: { string_contains: search } },
      ];
    }

    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          owners: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          _count: {
            select: {
              contacts: {
                where: {
                  leftAt: null,
                },
              },
            },
          },
        },
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      companies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async addOwner(companyId: number, userId: number, isPrimary = false) {
    return this.prisma.companyOwner.create({
      data: {
        companyId,
        userId,
        isPrimary,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });
  }

  async removeOwner(companyId: number, userId: number) {
    return this.prisma.companyOwner.delete({
      where: {
        companyId_userId: {
          companyId,
          userId,
        },
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });
  }

  async setPrimaryOwner(companyId: number, userId: number) {
    await this.prisma.$transaction([
      // Remove primary flag from all owners
      this.prisma.companyOwner.updateMany({
        where: { companyId },
        data: { isPrimary: false },
      }),
      // Set the new primary owner
      this.prisma.companyOwner.update({
        where: {
          companyId_userId: {
            companyId,
            userId,
          },
        },
        data: { isPrimary: true },
      }),
    ]);
  }

  async getCompaniesByOwner(
    organizationId: number,
    userId: number,
    pagination: PaginationOptions = {},
  ) {
    return this.findAll({ organizationId, ownerIds: [userId] }, pagination);
  }

  async addContact(companyId: number, input: AddContactToCompanyInput) {
    // If setting as primary, remove primary flag from other contacts
    if (input.isPrimary) {
      await this.prisma.companyContact.updateMany({
        where: {
          companyId,
          leftAt: null,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    return this.prisma.companyContact.create({
      data: {
        companyId,
        contactId: input.contactId,
        role: input.role,
        isPrimary: input.isPrimary ?? false,
        joinedAt: input.joinedAt ?? new Date(),
      },
      include: {
        contact: {
          include: {
            owners: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async removeContact(companyId: number, contactId: number) {
    // Set leftAt to mark the contact as no longer associated
    return this.prisma.companyContact.updateMany({
      where: {
        companyId,
        contactId,
        leftAt: null, // Only update active associations
      },
      data: {
        leftAt: new Date(),
      },
    });
  }

  async updateContactCompany(
    companyId: number,
    contactId: number,
    input: UpdateContactCompanyInput,
  ) {
    // If setting as primary, remove primary flag from other contacts
    if (input.isPrimary) {
      await this.prisma.companyContact.updateMany({
        where: {
          companyId,
          leftAt: null,
          NOT: {
            contactId,
          },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    return this.prisma.companyContact.updateMany({
      where: {
        companyId,
        contactId,
        leftAt: null,
      },
      data: input,
    });
  }

  async getActiveContacts(companyId: number) {
    return this.prisma.companyContact.findMany({
      where: {
        companyId,
        leftAt: null,
      },
      include: {
        contact: {
          include: {
            owners: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });
  }

  async getContactHistory(companyId: number) {
    return this.prisma.companyContact.findMany({
      where: {
        companyId,
      },
      include: {
        contact: {
          include: {
            owners: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });
  }

  async getCompaniesForContact(contactId: number, includeHistory = false) {
    return this.prisma.companyContact.findMany({
      where: {
        contactId,
        ...(includeHistory ? {} : { leftAt: null }),
      },
      include: {
        company: {
          include: {
            owners: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });
  }
}

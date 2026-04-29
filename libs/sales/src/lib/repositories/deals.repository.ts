import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../modules/prisma.types';
import type { PaginationOptions } from './types';
import type { EditorData } from '../types/sales-api';

export interface CreateDealInput {
  organizationId: number;
  title: string;
  value?: number;
  currency?: string;
  probability?: number;
  stage?: string;
  summary?: EditorData;
  expectedCloseDate?: Date;
  source?: string;
  priority?: number;
  ownerIds?: number[];
  primaryOwnerId?: number;
  fields?: Record<string, unknown>;
}

export interface UpdateDealInput {
  title?: string;
  value?: number;
  currency?: string;
  probability?: number;
  stage?: string;
  summary?: EditorData;
  expectedCloseDate?: Date;
  actualCloseDate?: Date;
  lostReason?: string;
  source?: string;
  priority?: number;
  isHidden?: boolean;
  fields?: Record<string, unknown>;
}

export interface DealFilters {
  organizationId: number;
  isHidden?: boolean;
  dealIds?: number[];
  ownerIds?: number[];
  companyIds?: number[];
  contactIds?: number[];
  stages?: string[];
  search?: string;
  minValue?: number;
  maxValue?: number;
  expectedCloseFrom?: Date;
  expectedCloseTo?: Date;
}

export interface AddCompanyToDealInput {
  companyId: number;
  isPrimary?: boolean;
}

export interface AddContactToDealInput {
  contactId: number;
  role?: string;
  isPrimary?: boolean;
}

export interface UpdateContactDealInput {
  role?: string;
  isPrimary?: boolean;
}

@Injectable()
export class DealsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateDealInput) {
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

    return this.prisma.deal.create({
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
        companies: {
          include: {
            company: {
              select: {
                id: true,
                companyName: true,
                website: true,
              },
            },
          },
        },
        contacts: {
          include: {
            contact: {
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

  async findById(id: number, organizationId: number) {
    return this.prisma.deal.findFirst({
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
        companies: {
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
        },
        contacts: {
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
        },
      },
    });
  }

  async update(id: number, input: UpdateDealInput) {
    const { fields: existingFields, ...otherData } = input;

    return this.prisma.deal.update({
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

  async findAll(filters: DealFilters, pagination: PaginationOptions = {}) {
    const {
      organizationId,
      isHidden = false,
      dealIds,
      ownerIds,
      companyIds,
      contactIds,
      stages,
      search,
      minValue,
      maxValue,
      expectedCloseFrom,
      expectedCloseTo,
    } = filters;
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.DealWhereInput = {
      organizationId,
      isHidden,
      ...(dealIds && dealIds.length > 0 ? { id: { in: dealIds } } : {}),
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
      ...(companyIds && companyIds.length > 0
        ? {
            companies: {
              some: {
                companyId: {
                  in: companyIds,
                },
              },
            },
          }
        : {}),
      ...(contactIds && contactIds.length > 0
        ? {
            contacts: {
              some: {
                contactId: {
                  in: contactIds,
                },
              },
            },
          }
        : {}),
      ...(stages && stages.length > 0
        ? {
            stage: {
              in: stages,
            },
          }
        : {}),
      ...(minValue !== undefined || maxValue !== undefined
        ? {
            value: {
              ...(minValue !== undefined ? { gte: minValue } : {}),
              ...(maxValue !== undefined ? { lte: maxValue } : {}),
            },
          }
        : {}),
      ...(expectedCloseFrom || expectedCloseTo
        ? {
            expectedCloseDate: {
              ...(expectedCloseFrom ? { gte: expectedCloseFrom } : {}),
              ...(expectedCloseTo ? { lte: expectedCloseTo } : {}),
            },
          }
        : {}),
    };

    if (search) {
      // Get dynamic field keys to include them in the OR search for precise value matching
      const customColumns = await this.prisma.tableColumn.findMany({
        where: { organizationId, tableName: 'deals' },
        select: { columnKey: true },
      });

      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { source: { contains: search, mode: 'insensitive' } },
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

    const [deals, total] = await Promise.all([
      this.prisma.deal.findMany({
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
          companies: {
            include: {
              company: {
                select: {
                  id: true,
                  companyName: true,
                  website: true,
                },
              },
            },
          },
          _count: {
            select: {
              companies: true,
              contacts: true,
            },
          },
        },
      }),
      this.prisma.deal.count({ where }),
    ]);

    return {
      deals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async addOwner(dealId: number, userId: number, isPrimary = false) {
    return this.prisma.dealOwner.create({
      data: {
        dealId,
        userId,
        isPrimary,
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async removeOwner(dealId: number, userId: number) {
    return this.prisma.dealOwner.delete({
      where: {
        dealId_userId: {
          dealId,
          userId,
        },
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async setPrimaryOwner(dealId: number, userId: number) {
    await this.prisma.$transaction([
      // Remove primary flag from all owners
      this.prisma.dealOwner.updateMany({
        where: { dealId },
        data: { isPrimary: false },
      }),
      // Set the new primary owner
      this.prisma.dealOwner.update({
        where: {
          dealId_userId: {
            dealId,
            userId,
          },
        },
        data: { isPrimary: true },
      }),
    ]);
  }

  async getDealsByOwner(
    organizationId: number,
    userId: number,
    pagination: PaginationOptions = {},
  ) {
    return this.findAll({ organizationId, ownerIds: [userId] }, pagination);
  }

  async addCompany(dealId: number, input: AddCompanyToDealInput) {
    // If setting as primary, remove primary flag from other companies
    if (input.isPrimary) {
      await this.prisma.dealCompany.updateMany({
        where: {
          dealId,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    return this.prisma.dealCompany.create({
      data: {
        dealId,
        companyId: input.companyId,
        isPrimary: input.isPrimary ?? false,
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
    });
  }

  async removeCompany(dealId: number, companyId: number) {
    return this.prisma.dealCompany.deleteMany({
      where: {
        dealId,
        companyId: companyId,
      },
    });
  }

  async updateCompany(dealId: number, companyId: number, isPrimary: boolean) {
    // If setting as primary, remove primary flag from other companies
    if (isPrimary) {
      await this.prisma.dealCompany.updateMany({
        where: {
          dealId,
          NOT: {
            companyId: companyId,
          },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    return this.prisma.dealCompany.updateMany({
      where: {
        dealId,
        companyId: companyId,
      },
      data: { isPrimary },
    });
  }

  async getCompanies(dealId: number) {
    return this.prisma.dealCompany.findMany({
      where: {
        dealId,
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
        createdAt: 'desc',
      },
    });
  }

  async addContact(dealId: number, input: AddContactToDealInput) {
    // If setting as primary, remove primary flag from other contacts
    if (input.isPrimary) {
      await this.prisma.dealContact.updateMany({
        where: {
          dealId,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    return this.prisma.dealContact.create({
      data: {
        dealId,
        contactId: input.contactId,
        role: input.role,
        isPrimary: input.isPrimary ?? false,
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

  async removeContact(dealId: number, contactId: number) {
    return this.prisma.dealContact.deleteMany({
      where: {
        dealId,
        contactId,
      },
    });
  }

  async updateContact(
    dealId: number,
    contactId: number,
    input: UpdateContactDealInput,
  ) {
    // If setting as primary, remove primary flag from other contacts
    if (input.isPrimary) {
      await this.prisma.dealContact.updateMany({
        where: {
          dealId,
          NOT: {
            contactId,
          },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    return this.prisma.dealContact.updateMany({
      where: {
        dealId,
        contactId,
      },
      data: input,
    });
  }

  async getContacts(dealId: number) {
    return this.prisma.dealContact.findMany({
      where: {
        dealId,
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
        createdAt: 'desc',
      },
    });
  }

  async getDealsByCompany(
    organizationId: number,
    companyId: number,
    pagination: PaginationOptions = {},
  ) {
    return this.findAll(
      { organizationId, companyIds: [companyId] },
      pagination,
    );
  }

  async getDealsByContact(
    organizationId: number,
    contactId: number,
    pagination: PaginationOptions = {},
  ) {
    return this.findAll(
      { organizationId, contactIds: [contactId] },
      pagination,
    );
  }
}

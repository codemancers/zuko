import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../modules/prisma.types';
import type { PaginationOptions } from './types';

export interface CreateContactInput {
  organizationId: number;
  name: string;
  email?: string;
  phone?: string;
  linkedinId?: string;
  notes?: string;
  ownerIds: number[];
  primaryOwnerId?: number;
}

export interface UpdateContactInput {
  name?: string;
  email?: string;
  phone?: string;
  linkedinId?: string;
  notes?: string;
  isHidden?: boolean;
}

export interface ContactFilters {
  organizationId: number;
  isHidden?: boolean;
  ownerIds?: number[];
  search?: string;
  contactIds?: number[];
}

@Injectable()
export class ContactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateContactInput) {
    const { ownerIds, primaryOwnerId, organizationId, ...contactData } = input;

    return this.prisma.contact.create({
      data: {
        ...contactData,
        organizationId,
        owners: {
          create: ownerIds.map((userId) => ({
            userId,
            isPrimary: primaryOwnerId
              ? userId === primaryOwnerId
              : userId === ownerIds[0],
          })),
        },
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

  async findById(id: number, organizationId: number) {
    return this.prisma.contact.findFirst({
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
      },
    });
  }

  async update(id: number, input: UpdateContactInput) {
    return this.prisma.contact.update({
      where: { id },
      data: input,
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

  async findAll(
    filters: ContactFilters,
    pagination: PaginationOptions = {},
  ) {
    const { organizationId, isHidden = false, ownerIds, search, contactIds } =
      filters;
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.ContactWhereInput = {
      organizationId,
      isHidden,
      ...(contactIds && contactIds.length > 0
        ? { id: { in: contactIds } }
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
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { linkedinId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async addOwner(contactId: number, userId: number, isPrimary = false) {
    return this.prisma.contactOwner.create({
      data: {
        contactId,
        userId,
        isPrimary,
      },
    });
  }

  async removeOwner(contactId: number, userId: number) {
    return this.prisma.contactOwner.delete({
      where: {
        contactId_userId: {
          contactId,
          userId,
        },
      },
    });
  }

  async setPrimaryOwner(contactId: number, userId: number) {
    await this.prisma.$transaction([
      // Remove primary flag from all owners
      this.prisma.contactOwner.updateMany({
        where: { contactId },
        data: { isPrimary: false },
      }),
      // Set the new primary owner
      this.prisma.contactOwner.update({
        where: {
          contactId_userId: {
            contactId,
            userId,
          },
        },
        data: { isPrimary: true },
      }),
    ]);
  }

  async getContactsByOwner(
    organizationId: number,
    userId: number,
    pagination: PaginationOptions = {},
  ) {
    return this.findAll({ organizationId, ownerIds: [userId] }, pagination);
  }
}

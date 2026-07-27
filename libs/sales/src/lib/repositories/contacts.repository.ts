import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../modules/prisma.types';
import type { PaginationOptions } from './types';
import type { EditorData } from '../types/sales-api';

export interface CreateContactInput {
  organizationId: number;
  name: string;
  email?: string;
  phone?: string;
  linkedinId?: string;
  notes?: EditorData;
  ownerIds?: number[];
  primaryOwnerId?: number;
  fields?: Record<string, unknown>;
  apolloPersonId?: string;
  apolloContactId?: string;
}

export interface UpdateContactInput {
  name?: string;
  email?: string;
  phone?: string;
  linkedinId?: string;
  notes?: EditorData;
  isHidden?: boolean;
  fields?: Record<string, unknown>;
  apolloPersonId?: string;
  apolloContactId?: string;
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

    return this.prisma.contact.create({
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

  async findByApolloPersonId(apolloPersonId: string, organizationId: number) {
    return this.prisma.contact.findFirst({
      where: { apolloPersonId, organizationId },
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
    const { fields: existingFields, ...otherData } = input;

    return this.prisma.contact.update({
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

  async findAll(filters: ContactFilters, pagination: PaginationOptions = {}) {
    const {
      organizationId,
      isHidden = false,
      ownerIds,
      search,
      contactIds,
    } = filters;
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
    };

    if (search) {
      // Get dynamic field keys to include them in the OR search for precise value matching
      const customColumns = await this.prisma.tableColumn.findMany({
        where: { organizationId, tableName: 'contacts' },
        select: { columnKey: true },
      });

      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { linkedinId: { contains: search, mode: 'insensitive' } },
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

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
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
      include: {
        user: { select: { id: true, name: true } },
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
      include: {
        user: { select: { id: true, name: true } },
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

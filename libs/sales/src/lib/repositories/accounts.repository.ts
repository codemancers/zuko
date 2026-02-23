import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../modules/prisma.types';
import type { PaginationOptions } from './types';

export interface CreateAccountInput {
  companyName: string;
  website?: string;
  linkedinUrl?: string;
  summary?: string;
  ownerIds: number[];
  primaryOwnerId?: number;
}

export interface UpdateAccountInput {
  companyName?: string;
  website?: string;
  linkedinUrl?: string;
  summary?: string;
  isHidden?: boolean;
}

export interface AccountFilters {
  isHidden?: boolean;
  ownerIds?: number[];
  search?: string;
}

export interface AddContactToAccountInput {
  contactId: number;
  role?: string;
  isPrimary?: boolean;
  joinedAt?: Date;
}

export interface UpdateContactAccountInput {
  role?: string;
  isPrimary?: boolean;
}

@Injectable()
export class AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAccountInput) {
    const { ownerIds, primaryOwnerId, ...accountData } = input;

    return this.prisma.salesAccount.create({
      data: {
        ...accountData,
        owners: {
          create: ownerIds.map((userId) => ({
            userId,
            isPrimary: primaryOwnerId ? userId === primaryOwnerId : userId === ownerIds[0],
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

  async findById(id: number) {
    return this.prisma.salesAccount.findUnique({
      where: { id },
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

  async update(id: number, input: UpdateAccountInput) {
    return this.prisma.salesAccount.update({
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

  async findAll(filters: AccountFilters = {}, pagination: PaginationOptions = {}) {
    const { isHidden = false, ownerIds, search } = filters;
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.SalesAccountWhereInput = {
      isHidden,
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
              { companyName: { contains: search, mode: 'insensitive' } },
              { website: { contains: search, mode: 'insensitive' } },
              { linkedinUrl: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [accounts, total] = await Promise.all([
      this.prisma.salesAccount.findMany({
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
      this.prisma.salesAccount.count({ where }),
    ]);

    return {
      accounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async addOwner(accountId: number, userId: number, isPrimary = false) {
    return this.prisma.accountOwner.create({
      data: {
        accountId,
        userId,
        isPrimary,
      },
    });
  }

  async removeOwner(accountId: number, userId: number) {
    return this.prisma.accountOwner.delete({
      where: {
        accountId_userId: {
          accountId,
          userId,
        },
      },
    });
  }

  async setPrimaryOwner(accountId: number, userId: number) {
    await this.prisma.$transaction([
      // Remove primary flag from all owners
      this.prisma.accountOwner.updateMany({
        where: { accountId },
        data: { isPrimary: false },
      }),
      // Set the new primary owner
      this.prisma.accountOwner.update({
        where: {
          accountId_userId: {
            accountId,
            userId,
          },
        },
        data: { isPrimary: true },
      }),
    ]);
  }

  async getAccountsByUser(userId: number, pagination: PaginationOptions = {}) {
    return this.findAll({ ownerIds: [userId] }, pagination);
  }

  async addContact(accountId: number, input: AddContactToAccountInput) {
    // If setting as primary, remove primary flag from other contacts
    if (input.isPrimary) {
      await this.prisma.accountContact.updateMany({
        where: {
          accountId,
          leftAt: null,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    return this.prisma.accountContact.create({
      data: {
        accountId,
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

  async removeContact(accountId: number, contactId: number) {
    // Set leftAt to mark the contact as no longer associated
    return this.prisma.accountContact.updateMany({
      where: {
        accountId,
        contactId,
        leftAt: null, // Only update active associations
      },
      data: {
        leftAt: new Date(),
      },
    });
  }

  async updateContactAccount(accountId: number, contactId: number, input: UpdateContactAccountInput) {
    // If setting as primary, remove primary flag from other contacts
    if (input.isPrimary) {
      await this.prisma.accountContact.updateMany({
        where: {
          accountId,
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

    return this.prisma.accountContact.updateMany({
      where: {
        accountId,
        contactId,
        leftAt: null,
      },
      data: input,
    });
  }

  async getActiveContacts(accountId: number) {
    return this.prisma.accountContact.findMany({
      where: {
        accountId,
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

  async getContactHistory(accountId: number) {
    return this.prisma.accountContact.findMany({
      where: {
        accountId,
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

  async getAccountsForContact(contactId: number, includeHistory = false) {
    return this.prisma.accountContact.findMany({
      where: {
        contactId,
        ...(includeHistory ? {} : { leftAt: null }),
      },
      include: {
        account: {
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

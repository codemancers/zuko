import { Injectable } from '@nestjs/common';
import { Prisma } from '@zuko/core';
import type { PrismaService } from '../modules/prisma.types';

@Injectable()
export class ConnectionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listAccountsForUser(userId: number) {
    return this.prisma.account.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  getAccountForProvider(userId: number, providerId: string) {
    return this.prisma.account.findFirst({
      where: {
        userId,
        providerId,
      },
    });
  }

  listProvidersForUser(userId: number) {
    return this.prisma.account.findMany({
      where: {
        userId,
      },
      select: {
        providerId: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  listProviderAccountsForUser(userId: number) {
    return this.prisma.account.findMany({
      where: {
        userId,
      },
      select: {
        providerId: true,
        accountId: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findAccounts(input: Prisma.AccountWhereInput) {
    return this.prisma.account.findMany({
      where: input,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}

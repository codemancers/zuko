import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { runInTenant, type TenantContext, type TenantTransaction } from './tenant-transaction';

export type { TenantContext, TenantTransaction } from './tenant-transaction';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Run `fn` in a transaction scoped to one organization. See `runInTenant`. */
  withTenant<T>(ctx: TenantContext, fn: (tx: TenantTransaction) => Promise<T>): Promise<T> {
    return runInTenant(this, ctx, fn);
  }
}

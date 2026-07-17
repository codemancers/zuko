import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ClaudeAiOauth } from './dto/upsert-account-oauth.dto';

@Injectable()
export class AccountsRepository {
  constructor(private readonly db: PrismaService) {}

  findClaudeAccount(userId: number) {
    return this.db.account.findFirst({
      where: { userId, providerId: 'claude' },
      select: {
        accessToken: true,
        refreshToken: true,
        accessTokenExpiresAt: true,
        scope: true,
      },
      orderBy: { id: 'desc' },
    });
  }

  findClaudeAccountWithId(userId: number) {
    return this.db.account.findFirst({
      where: { userId, providerId: 'claude' },
      select: {
        id: true,
        accessToken: true,
        refreshToken: true,
        accessTokenExpiresAt: true,
        scope: true,
      },
      orderBy: { id: 'desc' },
    });
  }

  async upsertClaudeOauth(userId: number, creds: ClaudeAiOauth): Promise<void> {
    const data = {
      userId,
      providerId: 'claude',
      accessToken: creds.accessToken,
      refreshToken: creds.refreshToken,
      accessTokenExpiresAt: new Date(creds.expiresAt),
      scope: creds.scopes.join(' '),
    };
    await this.db.$transaction(async (tx) => {
      const existing = await tx.account.findFirst({
        where: { userId, providerId: 'claude' },
        select: { id: true },
      });
      if (existing) {
        await tx.account.update({ where: { id: existing.id }, data });
      } else {
        await tx.account.create({
          data: { ...data, accountId: `claude_${userId}` },
        });
      }
    });
  }

  async updateClaudeTokens(id: number, oauth: ClaudeAiOauth): Promise<void> {
    await this.db.account.update({
      where: { id },
      data: {
        accessToken: oauth.accessToken,
        refreshToken: oauth.refreshToken,
        accessTokenExpiresAt: new Date(oauth.expiresAt),
        scope: oauth.scopes.join(' '),
      },
    });
  }

  async deleteByProvider(userId: number, providerId: string): Promise<void> {
    await this.db.account.deleteMany({ where: { userId, providerId } });
  }
}

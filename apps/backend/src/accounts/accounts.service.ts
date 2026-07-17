import { Injectable } from '@nestjs/common';
import type { ClaudeAiOauth } from './dto/upsert-account-oauth.dto';
import { getValidClaudeOauthWithStore } from './get-valid-claude-oauth';
import { AccountsRepository } from './accounts.repository';

@Injectable()
export class AccountsService {
  constructor(private readonly repo: AccountsRepository) {}

  async getClaudeAccount(userId: number) {
    return this.repo.findClaudeAccount(userId);
  }

  async upsertClaudeOauth(userId: number, creds: ClaudeAiOauth): Promise<void> {
    return this.repo.upsertClaudeOauth(userId, creds);
  }

  async deleteByProvider(userId: number, providerId: string): Promise<void> {
    return this.repo.deleteByProvider(userId, providerId);
  }

  async getValidClaudeOauth(userId: number): Promise<ClaudeAiOauth> {
    return getValidClaudeOauthWithStore(
      {
        read: (uid) => this.repo.findClaudeAccountWithId(uid),
        persist: (id, oauth) => this.repo.updateClaudeTokens(id, oauth),
      },
      userId,
    );
  }
}

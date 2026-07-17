import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountsRepository } from '../accounts/accounts.repository';
import { AccountsService } from '../accounts/accounts.service';
import { EveCredentialsController } from './eve-credentials.controller';
import { EveProxyController } from './eve-proxy.controller';
import { EvePrincipalGuard } from './eve-principal.guard';
import { EveTargetService } from './eve-target.service';
import { EveChatsController } from './eve-chats.controller';
import { EveChatsRepository } from './eve-chats.repository';
import { EveProxyService } from './eve-proxy.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    EveCredentialsController,
    EveProxyController,
    EveChatsController,
  ],
  providers: [
    EvePrincipalGuard,
    EveTargetService,
    EveProxyService,
    EveChatsRepository,
    AccountsRepository,
    AccountsService,
  ],
})
export class EveModule {}

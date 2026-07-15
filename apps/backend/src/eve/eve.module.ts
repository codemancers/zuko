import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountsService } from '../accounts/accounts.service';
import { EveCredentialsController } from './eve-credentials.controller';
import { EveProxyController } from './eve-proxy.controller';
import { EvePrincipalGuard } from './eve-principal.guard';
import { EveTargetService } from './eve-target.service';
import { EveChatsController } from './eve-chats.controller';
import { EveChatsRepository } from './eve-chats.repository';

@Module({
  imports: [PrismaModule],
  controllers: [EveCredentialsController, EveProxyController, EveChatsController],
  providers: [EvePrincipalGuard, EveTargetService, EveChatsRepository, AccountsService],
})
export class EveModule {}

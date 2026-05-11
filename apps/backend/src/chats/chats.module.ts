import { Module } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { ChatsRepository } from './chats.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentsWrapperModule } from '../app/agents/agents.module';
import { SandboxLifecycleModule } from '../sandbox-lifecycle/sandbox-lifecycle.module';

@Module({
  imports: [PrismaModule, AgentsWrapperModule, SandboxLifecycleModule],
  controllers: [ChatsController],
  providers: [ChatsService, ChatsRepository],
  exports: [ChatsService],
})
export class ChatsModule {}

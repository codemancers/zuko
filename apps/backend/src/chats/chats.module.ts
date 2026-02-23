import { Module } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentsWrapperModule } from '../app/agents/agents.module';

@Module({
  imports: [PrismaModule, AgentsWrapperModule],
  controllers: [ChatsController],
  providers: [ChatsService],
  exports: [ChatsService],
})
export class ChatsModule {}

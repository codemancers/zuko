import { Module } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { ChatsRepository } from './chats.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentsWrapperModule } from '../app/agents/agents.module';
import { LangsmithService } from '../langsmith/langsmith.service';
import { SpritesService } from '../sprites/sprites.service';

@Module({
  imports: [PrismaModule, AgentsWrapperModule],
  controllers: [ChatsController],
  providers: [ChatsService, ChatsRepository, LangsmithService, SpritesService],
  exports: [ChatsService],
})
export class ChatsModule {}

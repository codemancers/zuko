import { Module } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentsWrapperModule } from '../app/agents/agents.module';
import { LangsmithService } from '../langsmith/langsmith.service';
import { SpritesService } from '../sprites/sprites.service';

@Module({
  imports: [PrismaModule, AgentsWrapperModule],
  controllers: [ChatsController],
  providers: [ChatsService, LangsmithService, SpritesService],
  exports: [ChatsService],
})
export class ChatsModule {}

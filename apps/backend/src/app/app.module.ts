import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { ChatController } from '../chat/chat.controller';
import { ChatsModule } from '../chats/chats.module';
import { GraphController } from '../graph/graph.controller';
import { agentsEnvSchema } from './env.validation';
import { LangsmithService } from '../langsmith/langsmith.service';
import { SalesModule } from './sales/sales.module';
import { TasksModule } from './tasks/tasks.module';
import { AgentsWrapperModule } from './agents/agents.module';
import { AdminModule } from './admin/admin.module';
import { auth } from '../libs/better-auth/auth';

const authModule = AuthModule.forRoot({ auth, disableGlobalAuthGuard: true });

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'test'
          ? ['.env.test.local', '.env.test']
          : ['.env.local', '.env'],
      validationSchema: agentsEnvSchema,
    }),
    PrismaModule,
    authModule,
    AgentsWrapperModule,
    SalesModule,
    TasksModule,
    ChatsModule,
    AdminModule,
  ],
  controllers: [AppController, ChatController, GraphController],
  providers: [AppService, LangsmithService],
})
export class AppModule {}

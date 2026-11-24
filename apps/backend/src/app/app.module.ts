import { Module } from '@nestjs/common';
import { WorkflowRuntimeModule } from '../workflow/workflow.module';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { CrmModule } from '../crm/crm.module';
import { createAuth } from '../libs/better-auth/auth';
import { McpModule } from '../mcp/mcp.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    PrismaModule,
    WorkflowRuntimeModule,
    CrmModule,
    McpModule,
    AuthModule.forRootAsync({
      inject: [PrismaService],
      // CORS is enabled in main.ts: the module's own handling hardcodes GET/POST/PUT/DELETE,
      // which leaves out PATCH (record updates).
      useFactory: (prisma: PrismaService) => ({ auth: createAuth(prisma), disableTrustedOriginsCors: true }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

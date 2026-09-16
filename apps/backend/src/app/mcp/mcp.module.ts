import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { WellKnownController } from './well-known.controller';
import { McpBearerGuard } from './mcp-bearer.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesModule } from '../sales/sales.module';
import { IcpModule } from '../icp/icp.module';
import { LeadsModule } from '../leads/leads.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [SalesModule, IcpModule, LeadsModule, IntegrationsModule],
  controllers: [McpController, WellKnownController],
  providers: [McpBearerGuard, PrismaService],
})
export class McpModule {}

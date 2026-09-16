import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { WellKnownController } from './well-known.controller';
import { McpBearerGuard } from './mcp-bearer.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesModule } from '../sales/sales.module';
import { IcpModule } from '../icp/icp.module';

@Module({
  imports: [SalesModule, IcpModule],
  controllers: [McpController, WellKnownController],
  providers: [McpBearerGuard, PrismaService],
})
export class McpModule {}

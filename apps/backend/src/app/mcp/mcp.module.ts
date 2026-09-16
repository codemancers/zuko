import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { WellKnownController } from './well-known.controller';
import { McpBearerGuard } from './mcp-bearer.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesModule } from '../sales/sales.module';

@Module({
  imports: [SalesModule],
  controllers: [McpController, WellKnownController],
  providers: [McpBearerGuard, PrismaService],
})
export class McpModule {}

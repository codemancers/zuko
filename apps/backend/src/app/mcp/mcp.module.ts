import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { WellKnownController } from './well-known.controller';
import { McpBearerGuard } from './mcp-bearer.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [McpController, WellKnownController],
  providers: [McpBearerGuard, PrismaService],
})
export class McpModule {}

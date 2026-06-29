import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { WellKnownController } from './well-known.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [McpController, WellKnownController],
  providers: [PrismaService],
})
export class McpModule {}

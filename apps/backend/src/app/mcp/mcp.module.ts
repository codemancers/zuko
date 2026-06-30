import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { WellKnownController } from './well-known.controller';
import { McpBearerGuard } from './mcp-bearer.guard';

@Module({
  controllers: [McpController, WellKnownController],
  providers: [McpBearerGuard],
})
export class McpModule {}

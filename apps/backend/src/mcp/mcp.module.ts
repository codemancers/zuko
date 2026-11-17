import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { McpController } from './mcp.controller';
import { WellKnownController } from './well-known.controller';

@Module({ imports: [CrmModule], controllers: [McpController, WellKnownController] })
export class McpModule {}

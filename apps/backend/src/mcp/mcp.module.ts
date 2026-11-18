import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { McpController } from './mcp.controller';
import { WellKnownController } from './well-known.controller';

@Module({
  imports: [CrmModule],
  controllers: [McpController, WellKnownController, ConnectionsController],
  providers: [ConnectionsService],
})
export class McpModule {}

import { Module } from '@nestjs/common';
import { AdminService } from '../services/admin.service';
import { OrchestratorService } from '../services/orchestrator.service';
import { ConnectionsRepository } from '../repositories/connections.repository';
import { SalesModule } from '@zuko/sales';

@Module({
  imports: [SalesModule],
  providers: [
    AdminService,
    OrchestratorService,
    ConnectionsRepository,
  ],
  exports: [
    AdminService,
    OrchestratorService,
    ConnectionsRepository,
  ],
})
export class AgentsModule {}

import { Module } from '@nestjs/common';
import { AgentAuthBridgeModule } from '../app/agent-auth-bridge/agent-auth-bridge.module';
import { AgentService } from './agent.service';

@Module({
  imports: [AgentAuthBridgeModule],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}

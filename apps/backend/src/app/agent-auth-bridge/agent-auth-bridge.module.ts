import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AgentAuthBridgeService } from './agent-auth-bridge.service';

@Module({
  imports: [PrismaModule],
  providers: [AgentAuthBridgeService],
  exports: [AgentAuthBridgeService],
})
export class AgentAuthBridgeModule {}

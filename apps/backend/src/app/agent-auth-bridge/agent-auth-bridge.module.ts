import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AgentAuthBridgeService } from './agent-auth-bridge.service';
import { AgentAuthBridgeController } from './agent-auth-bridge.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AgentAuthBridgeController],
  providers: [AgentAuthBridgeService],
  exports: [AgentAuthBridgeService],
})
export class AgentAuthBridgeModule {}

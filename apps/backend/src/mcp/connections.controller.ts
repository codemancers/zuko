import { Controller, Delete, Get, Param } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ConnectionsService } from './connections.service';

/** The signed-in user's own connected applications, across all their organizations. */
@Controller('v1/connections')
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Get()
  list(@Session() session: UserSession) {
    return this.connections.list(BigInt(session.user.id as string | number));
  }

  @Delete(':id')
  disconnect(@Session() session: UserSession, @Param('id') id: string) {
    return this.connections.disconnect(BigInt(session.user.id as string | number), id);
  }
}

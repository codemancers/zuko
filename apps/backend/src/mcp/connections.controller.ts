import { Controller, Delete, Get, Param, Req } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ConnectionsService } from './connections.service';
import { requestInfo, type HttpRequest } from './http';

/** The signed-in user's own connected applications, across all their organizations. */
@Controller('v1/connections')
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Get()
  list(@Session() session: UserSession) {
    return this.connections.list(BigInt(session.user.id as string | number));
  }

  @Delete(':id')
  disconnect(@Session() session: UserSession, @Param('id') id: string, @Req() req: HttpRequest) {
    return this.connections.disconnect(BigInt(session.user.id as string | number), id, requestInfo(req));
  }
}

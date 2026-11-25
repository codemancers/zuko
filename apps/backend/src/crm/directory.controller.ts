import { Controller, Get, UseGuards } from '@nestjs/common';
import { HarnessAccess, Crm, CrmContextGuard, type RequestContext } from './context';
import { DirectoryService } from './directory.service';

@Controller('v1')
@UseGuards(CrmContextGuard)
export class DirectoryController {
  constructor(private readonly directory: DirectoryService) {}

  @Get('members')
  @HarnessAccess('directory:read')
  members(@Crm() ctx: RequestContext) {
    return this.directory.members(ctx);
  }

  @Get('teams')
  @HarnessAccess('directory:read')
  teams(@Crm() ctx: RequestContext) {
    return this.directory.teams(ctx);
  }
}

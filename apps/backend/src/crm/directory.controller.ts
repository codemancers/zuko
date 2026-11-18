import { Controller, Get, UseGuards } from '@nestjs/common';
import { Crm, CrmContextGuard, type RequestContext } from './context';
import { DirectoryService } from './directory.service';

@Controller('v1')
@UseGuards(CrmContextGuard)
export class DirectoryController {
  constructor(private readonly directory: DirectoryService) {}

  @Get('members')
  members(@Crm() ctx: RequestContext) {
    return this.directory.members(ctx);
  }

  @Get('teams')
  teams(@Crm() ctx: RequestContext) {
    return this.directory.teams(ctx);
  }
}

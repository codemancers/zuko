import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AccessService } from './access.service';
import { Crm, CrmContextGuard, type RequestContext } from './context';
import { SharesService } from './shares.service';

@Controller('v1')
@UseGuards(CrmContextGuard)
export class AccessController {
  constructor(
    private readonly access: AccessService,
    private readonly shares: SharesService,
  ) {}

  @Get('access/roles')
  list(@Crm() ctx: RequestContext) {
    return this.access.list(ctx);
  }

  @Put('access/roles/:role')
  set(@Crm() ctx: RequestContext, @Param('role') role: string, @Body() body: unknown) {
    return this.access.set(ctx, role, body);
  }

  @Delete('access/roles/:role')
  unset(@Crm() ctx: RequestContext, @Param('role') role: string, @Query('object') object?: string) {
    return this.access.remove(ctx, role, object);
  }

  @Get('objects/:object/records/:id/shares')
  listShares(@Crm() ctx: RequestContext, @Param('object') object: string, @Param('id') id: string) {
    return this.shares.list(ctx, object, id);
  }

  @Post('objects/:object/records/:id/shares')
  share(@Crm() ctx: RequestContext, @Param('object') object: string, @Param('id') id: string, @Body() body: unknown) {
    return this.shares.add(ctx, object, id, body);
  }

  @Delete('objects/:object/records/:id/shares/:shareId')
  unshare(
    @Crm() ctx: RequestContext,
    @Param('object') object: string,
    @Param('id') id: string,
    @Param('shareId') shareId: string,
  ) {
    return this.shares.remove(ctx, object, id, shareId);
  }
}

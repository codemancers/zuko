import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Crm, CrmContextGuard, type RequestContext } from './context';
import { SchemaService } from './schema.service';

@Controller('v1')
@UseGuards(CrmContextGuard)
export class ObjectsController {
  constructor(private readonly schema: SchemaService) {}

  /** The resolved request context: handy for checking who the API thinks you are. */
  @Get('me')
  me(@Crm() ctx: RequestContext) {
    return {
      user_id: String(ctx.userId),
      organization_id: String(ctx.organizationId),
      roles: ctx.roles,
      team_ids: ctx.teamIds.map(String),
    };
  }

  @Get('objects')
  list(@Crm() ctx: RequestContext) {
    return this.schema.list(ctx);
  }

  @Post('objects')
  create(@Crm() ctx: RequestContext, @Body() body: unknown) {
    return this.schema.createObject(ctx, body);
  }

  @Get('objects/:object')
  describe(@Crm() ctx: RequestContext, @Param('object') object: string) {
    return this.schema.describe(ctx, object);
  }

  @Post('objects/:object/fields')
  addField(@Crm() ctx: RequestContext, @Param('object') object: string, @Body() body: unknown) {
    return this.schema.addField(ctx, object, body);
  }
}

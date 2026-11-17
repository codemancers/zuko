import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Crm, CrmContextGuard, type RequestContext } from './context';
import { can } from './permissions';
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
      // Lets a client offer schema changes only to those who can make them.
      can_manage_objects: can(ctx, { object: ['manage'] }),
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

  /** Create contact, company and deal if the organization does not have them. Safe to repeat. */
  @Post('setup/standard-objects')
  @HttpCode(200)
  setupStandardObjects(@Crm() ctx: RequestContext) {
    return this.schema.setupStandardObjects(ctx);
  }

  @Get('objects/:object')
  describe(@Crm() ctx: RequestContext, @Param('object') object: string) {
    return this.schema.describe(ctx, object);
  }

  @Post('objects/:object/fields')
  addField(@Crm() ctx: RequestContext, @Param('object') object: string, @Body() body: unknown) {
    return this.schema.addField(ctx, object, body);
  }

  @Patch('objects/:object/fields/:field')
  updateField(@Crm() ctx: RequestContext, @Param('object') object: string, @Param('field') field: string, @Body() body: unknown) {
    return this.schema.updateField(ctx, object, field, body);
  }

  @Delete('objects/:object/fields/:field')
  removeField(@Crm() ctx: RequestContext, @Param('object') object: string, @Param('field') field: string) {
    return this.schema.removeField(ctx, object, field);
  }
}

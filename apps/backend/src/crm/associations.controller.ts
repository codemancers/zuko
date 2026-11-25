import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AssociationsService } from './associations.service';
import { HarnessAccess, Crm, CrmContextGuard, type RequestContext } from './context';

/** The records linked to a record, by the kind of record on the other end. Many-to-many, the same from either side. */
@Controller('v1/objects/:object/records/:id/associations/:link')
@UseGuards(CrmContextGuard)
export class AssociationsController {
  constructor(private readonly associations: AssociationsService) {}

  @Get()
  @HarnessAccess('records:read')
  list(
    @Crm() ctx: RequestContext,
    @Param('object') object: string,
    @Param('id') id: string,
    @Param('link') link: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.associations.list(ctx, object, id, link, query);
  }

  /** Set the linked records to exactly `record_ids`. */
  @Put()
  replace(
    @Crm() ctx: RequestContext,
    @Param('object') object: string,
    @Param('id') id: string,
    @Param('link') link: string,
    @Body() body: unknown,
  ) {
    return this.associations.replace(ctx, object, id, link, body);
  }

  @Post()
  @HttpCode(200)
  @HarnessAccess('records:write')
  link(
    @Crm() ctx: RequestContext,
    @Param('object') object: string,
    @Param('id') id: string,
    @Param('link') link: string,
    @Body() body: unknown,
  ) {
    return this.associations.link(ctx, object, id, link, body);
  }

  @Delete(':targetId')
  @HarnessAccess('records:write')
  unlink(
    @Crm() ctx: RequestContext,
    @Param('object') object: string,
    @Param('id') id: string,
    @Param('link') link: string,
    @Param('targetId') targetId: string,
  ) {
    return this.associations.unlink(ctx, object, id, link, targetId);
  }
}

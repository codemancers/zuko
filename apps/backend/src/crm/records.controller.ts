import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { HarnessAccess, Crm, CrmContextGuard, type RequestContext } from './context';
import { RecordsQueryService } from './records-query.service';
import { RecordsService } from './records.service';

@Controller('v1/objects/:object/records')
@UseGuards(CrmContextGuard)
export class RecordsController {
  constructor(
    private readonly records: RecordsService,
    private readonly queries: RecordsQueryService,
  ) {}

  @Get()
  @HarnessAccess('records:read')
  list(
    @Crm() ctx: RequestContext,
    @Param('object') object: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.queries.list(ctx, object, query);
  }

  /** A query, not a creation: 200 rather than POST's default 201. */
  @Post('filter')
  @HttpCode(200)
  @HarnessAccess('records:read')
  filter(@Crm() ctx: RequestContext, @Param('object') object: string, @Body() body: unknown) {
    return this.queries.filter(ctx, object, body);
  }

  @Post('facets')
  @HttpCode(200)
  @HarnessAccess('records:read')
  facets(@Crm() ctx: RequestContext, @Param('object') object: string, @Body() body: unknown) {
    return this.queries.facets(ctx, object, body);
  }

  @Post()
  @HarnessAccess('records:write')
  create(@Crm() ctx: RequestContext, @Param('object') object: string, @Body() body: unknown) {
    return this.records.create(ctx, object, body);
  }

  @Get(':id')
  @HarnessAccess('records:read')
  get(@Crm() ctx: RequestContext, @Param('object') object: string, @Param('id') id: string) {
    return this.records.get(ctx, object, id);
  }

  /** Everything attached to the record: its file fields and its comments. */
  @Get(':id/files')
  @HarnessAccess('records:read')
  files(@Crm() ctx: RequestContext, @Param('object') object: string, @Param('id') id: string, @Query() query: Record<string, string | undefined>) {
    return this.records.listFiles(ctx, object, id, query);
  }

  @Patch(':id')
  @HarnessAccess('records:write')
  update(
    @Crm() ctx: RequestContext,
    @Param('object') object: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.records.update(ctx, object, id, body);
  }

  @Delete(':id')
  @HarnessAccess('records:delete')
  remove(@Crm() ctx: RequestContext, @Param('object') object: string, @Param('id') id: string) {
    return this.records.remove(ctx, object, id);
  }

  @Get(':id/history')
  @HarnessAccess('records:read')
  history(@Crm() ctx: RequestContext, @Param('object') object: string, @Param('id') id: string) {
    return this.records.history(ctx, object, id);
  }
}

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
import { Crm, CrmContextGuard, type RequestContext } from './context';
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
  filter(@Crm() ctx: RequestContext, @Param('object') object: string, @Body() body: unknown) {
    return this.queries.filter(ctx, object, body);
  }

  @Post('facets')
  @HttpCode(200)
  facets(@Crm() ctx: RequestContext, @Param('object') object: string, @Body() body: unknown) {
    return this.queries.facets(ctx, object, body);
  }

  @Post()
  create(@Crm() ctx: RequestContext, @Param('object') object: string, @Body() body: unknown) {
    return this.records.create(ctx, object, body);
  }

  @Get(':id')
  get(@Crm() ctx: RequestContext, @Param('object') object: string, @Param('id') id: string) {
    return this.records.get(ctx, object, id);
  }

  @Patch(':id')
  update(
    @Crm() ctx: RequestContext,
    @Param('object') object: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.records.update(ctx, object, id, body);
  }

  @Delete(':id')
  remove(@Crm() ctx: RequestContext, @Param('object') object: string, @Param('id') id: string) {
    return this.records.remove(ctx, object, id);
  }

  @Get(':id/history')
  history(@Crm() ctx: RequestContext, @Param('object') object: string, @Param('id') id: string) {
    return this.records.history(ctx, object, id);
  }
}

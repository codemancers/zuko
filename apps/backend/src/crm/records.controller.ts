import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Crm, CrmContextGuard, type RequestContext } from './context';
import { RecordsService } from './records.service';

@Controller('v1/objects/:object/records')
@UseGuards(CrmContextGuard)
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Post()
  create(@Crm() ctx: RequestContext, @Param('object') object: string, @Body() body: unknown) {
    return this.records.create(ctx, object, body);
  }

  @Get(':id')
  get(@Crm() ctx: RequestContext, @Param('object') object: string, @Param('id') id: string) {
    return this.records.get(ctx, object, id);
  }

  @Patch(':id')
  update(@Crm() ctx: RequestContext, @Param('object') object: string, @Param('id') id: string, @Body() body: unknown) {
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

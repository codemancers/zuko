import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Crm, CrmContextGuard, HarnessAccess, type RequestContext } from '../crm/context';
import { requestInfo, type HttpRequest } from '../connections/http';
import { ApolloService } from './apollo.service';

/** The organization's Apollo connection. Connecting is for admins; everyone can see whether it is on. */
@Controller('v1/integrations/apollo')
@UseGuards(CrmContextGuard)
export class ApolloController {
  constructor(private readonly apollo: ApolloService) {}

  @Get()
  status(@Crm() ctx: RequestContext) {
    return this.apollo.status(ctx);
  }

  @Put()
  connect(@Crm() ctx: RequestContext, @Body() body: unknown, @Req() req: HttpRequest) {
    return this.apollo.connect(ctx, body, requestInfo(req));
  }

  @Delete()
  disconnect(@Crm() ctx: RequestContext, @Req() req: HttpRequest) {
    return this.apollo.disconnect(ctx, requestInfo(req));
  }
}

@Controller('v1/objects/:object/records/:id')
@UseGuards(CrmContextGuard)
export class RecordEnrichmentController {
  constructor(private readonly apollo: ApolloService) {}

  /** What providers have said about a record. */
  @Get('enrichment')
  @HarnessAccess('records:read')
  list(@Crm() ctx: RequestContext, @Param('object') object: string, @Param('id') id: string) {
    return this.apollo.enrichment(ctx, object, id);
  }

  /** Spends Apollo credits, so it is a POST that must be asked for. 200: it looks something up. */
  @Post('enrich')
  @HttpCode(200)
  @HarnessAccess('records:write')
  enrich(
    @Crm() ctx: RequestContext,
    @Param('object') object: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: HttpRequest,
  ) {
    return this.apollo.enrich(ctx, object, id, body, requestInfo(req));
  }
}

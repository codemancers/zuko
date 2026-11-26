import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { Crm, CrmContextGuard, HarnessAccess, type RequestContext } from './context';

@Controller('v1/objects/:object/records/:id')
@UseGuards(CrmContextGuard)
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  /** Comments and the record's changes in one timeline. It carries both, so it needs the comment scope. */
  @Get('activity')
  @HarnessAccess('comments:read')
  activity(@Crm() ctx: RequestContext, @Param('object') object: string, @Param('id') id: string, @Query() query: unknown) {
    return this.comments.activity(ctx, object, id, query);
  }

  @Get('comments')
  @HarnessAccess('comments:read')
  list(@Crm() ctx: RequestContext, @Param('object') object: string, @Param('id') id: string, @Query() query: unknown) {
    return this.comments.list(ctx, object, id, query);
  }

  @Post('comments')
  @HarnessAccess('comments:write')
  create(@Crm() ctx: RequestContext, @Param('object') object: string, @Param('id') id: string, @Body() body: unknown) {
    return this.comments.create(ctx, object, id, body);
  }

  @Patch('comments/:commentId')
  @HarnessAccess('comments:write')
  update(
    @Crm() ctx: RequestContext,
    @Param('object') object: string,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() body: unknown,
  ) {
    return this.comments.update(ctx, object, id, commentId, body);
  }

  @Delete('comments/:commentId')
  @HarnessAccess('comments:write')
  remove(@Crm() ctx: RequestContext, @Param('object') object: string, @Param('id') id: string, @Param('commentId') commentId: string) {
    return this.comments.remove(ctx, object, id, commentId);
  }
}

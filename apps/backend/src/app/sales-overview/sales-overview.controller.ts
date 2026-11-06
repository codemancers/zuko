import {
  Controller,
  Get,
  Header,
  UseGuards,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  Inject,
} from '@nestjs/common';
import { TaskRepository } from '@zuko/sales';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { SalesOverviewGuard } from '../../common/auth/sales-overview.guard';
import { OrgId } from '../../common/auth/org-id.decorator';

@Controller('sales-overview')
@UseGuards(AuthGuard, SalesOverviewGuard)
export class SalesOverviewController {
  constructor(@Inject(TaskRepository) private readonly tasks: TaskRepository) {}

  // Caller supplies its local calendar day; never guess today from server TZ.
  @Get('needs-attention')
  @Header('Cache-Control', 'private, no-store')
  needsAttention(
    @OrgId() organizationId: number,
    @Query('date') date: string,
    @Query('page', new DefaultValuePipe(1), new ParseIntPipe()) page: number,
    @Query('limit', new DefaultValuePipe(50), new ParseIntPipe()) limit: number,
  ) {
    return this.tasks.findNeedsAttention(organizationId, { date, page, limit });
  }

  // Permission probe only: section queries are separate follow-on tickets.
  @Get('access')
  @Header('Cache-Control', 'private, no-store')
  access(@OrgId() organizationId: number) {
    return { organizationId };
  }
}

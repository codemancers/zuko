import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { SalesOverviewGuard } from '../../common/auth/sales-overview.guard';
import { OrgId } from '../../common/auth/org-id.decorator';

@Controller('sales-overview')
@UseGuards(AuthGuard, SalesOverviewGuard)
export class SalesOverviewController {
  // Permission probe only: section queries are separate follow-on tickets.
  @Get('access')
  @Header('Cache-Control', 'private, no-store')
  access(@OrgId() organizationId: number) {
    return { organizationId };
  }
}

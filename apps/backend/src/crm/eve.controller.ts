import { Controller, Header, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Crm, CrmContextGuard, type RequestContext } from './context';
import { HarnessGrantsService } from '../libs/eve/harness-grants.service';
import { AGENT_SCOPE, HARNESS_ROUTE_RESOURCE, CRM_SCOPES } from '../libs/better-auth/constants';

@Controller('v1/eve')
@UseGuards(CrmContextGuard)
export class EveController {
  constructor(private readonly grants: HarnessGrantsService) {}

  /** Exchange the browser session for a backend-signed, organization-bound Eve token. */
  @Post('token')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async token(
    @Crm() ctx: RequestContext,
    @Req() req: { session: { session: { id: string; expiresAt: Date } } },
  ) {
    const session = req.session.session;
    const grant = await this.grants.create(
      ctx.userId,
      ctx.organizationId,
      'session',
      BigInt(session.id),
      [...Object.values(CRM_SCOPES), AGENT_SCOPE],
      new Date(session.expiresAt),
    );
    return this.grants.sign(grant, HARNESS_ROUTE_RESOURCE, 300);
  }
}

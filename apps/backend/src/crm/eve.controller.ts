import {
  Controller,
  Header,
  HttpCode,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { Crm, CrmContextGuard, type RequestContext } from './context';
import { issueEveRouteToken } from '../libs/eve/tokens';

@Controller('v1/eve')
@UseGuards(CrmContextGuard)
export class EveController {
  /** A browser exchanges its normal Zuko session for a short-lived, org-scoped Eve token. */
  @Post('token')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  token(@Crm() ctx: RequestContext) {
    const issued = issueEveRouteToken(ctx.userId, ctx.organizationId);
    if (!issued) {
      throw new ServiceUnavailableException('The Zuko agent is not configured');
    }
    return { access_token: issued.token, expires_at: issued.expiresAt };
  }
}

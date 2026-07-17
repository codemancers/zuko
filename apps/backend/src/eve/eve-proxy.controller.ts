import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { EveProxyService } from './eve-proxy.service';
import { resolveOrgId } from './resolve-org';
import { auth } from '../libs/better-auth/auth';

export { buildUpstreamHeaders } from './eve-proxy-headers';

@AllowAnonymous()
@Controller('eve/v1')
export class EveProxyController {
  constructor(
    @Inject(EveProxyService) private readonly eveProxy: EveProxyService,
  ) {}

  @All('*')
  async proxy(
    @Req() req: ExpressRequest,
    @Res() res: ExpressResponse,
  ): Promise<void> {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    const userId = Number(session?.user?.id);
    if (!Number.isFinite(userId)) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }

    const orgId = resolveOrgId(req);
    await this.eveProxy.verifyOrgMembership(userId, orgId);
    await this.eveProxy.proxy(req, res, { userId, orgId });
  }
}

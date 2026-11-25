import { Body, Controller, Header, HttpCode, Post, Req } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { CRM_RESOURCE } from '../libs/better-auth/constants';
import { HarnessGrantsService } from '../libs/eve/harness-grants.service';
import { CrmContextService } from './context';

interface HttpRequest {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

@Controller('v1/harness')
@AllowAnonymous()
export class HarnessController {
  constructor(
    private readonly grants: HarnessGrantsService,
    private readonly contexts: CrmContextService,
  ) {}

  @Post('delegate')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async delegate(
    @Req() req: HttpRequest,
    @Body() body: { reference?: string; organization_id?: string },
  ) {
    this.grants.requireService(req.headers['x-zuko-harness-key'], req.socket?.remoteAddress);
    const grant = await this.grants.resolve(body?.reference, body?.organization_id);
    await this.contexts.build({
      userId: grant.userId,
      organizationId: grant.organizationId,
      actorType: 'MCP',
    });
    return this.grants.sign(grant, CRM_RESOURCE, 60);
  }
}
